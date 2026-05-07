import { AuthPrincipal, IdentityMount } from "../types/core.js";
import { readOptionalText } from "./json.js";
import { IdentityBundle, IdentityLoader } from "./identity-loader.js";
import { PolicyService } from "./policy-service.js";

interface PrepareInboundInput {
  message?: string;
  conversation_id?: string | null;
  owner_verified?: boolean;
  trust_level?: string;
  auth?: AuthPrincipal;
}

const RISK_PATTERNS = [
  "refund",
  "invoice",
  "double charged",
  "payment",
  "charge",
  "credential",
  "password",
  "publish",
  "send",
  "schedule",
  "price",
  "quote",
  "contract",
  "legal",
  "approve",
  "activate",
];

const OWNER_SETUP_PATTERNS = ["owner", "setup", "configure", "onboard", "identity", "what should", "start"];

export class InboundService {
  constructor(
    private readonly loader: IdentityLoader,
    private readonly policy: PolicyService
  ) {}

  async prepare(mount: IdentityMount, input: PrepareInboundInput): Promise<Record<string, unknown>> {
    const status = await this.loader.status(mount);
    const access = this.accessPosture(input.auth);
    if (status.state !== "ready") {
      return {
        identity_id: status.identity_id,
        state: status.state,
        loadable: false,
        access,
        status,
        next: status.recommended_next,
        runtime_instruction:
          status.state === "uninitialized"
            ? "Initialize only if the current credential exposes initialization and the runtime is authorized to bootstrap this identity. Do not expose technical bootstrap fields to the user."
            : "Do not call manifest repeatedly. Explain that this identity needs owner/admin repair unless the current request is owner/admin troubleshooting.",
      };
    }

    const bundle = await this.loader.load(mount);
    const routes = this.policy.activeRoutes(bundle);
    const routeId = this.selectRoute(bundle, routes, input);
    const route = routes[routeId];
    const agentId = String(route?.agent_id ?? this.firstActiveAgent(bundle) ?? "stop");
    const agent = this.policy.agentRecord(bundle, agentId);
    const promptRef = String(agent.prompt_ref ?? "");
    const prompt = promptRef ? await readOptionalText(mount.store, promptRef) : null;
    const outputContracts = bundle.output_contracts.contracts as Record<string, unknown> | undefined;
    const outputContractName = String(agent.output_contract ?? "");

    return {
      identity_id: bundle.identity_id,
      state: "ready",
      loadable: true,
      inbound: {
        message_summary: this.compactMessage(input.message),
        low_information: this.isLowInformation(input.message),
        risk_detected: this.hasRisk(input.message),
        owner_verified: Boolean(input.owner_verified),
        trust_level: input.trust_level ?? (input.owner_verified ? "verified_owner" : "unverified"),
      },
      access,
      identity: {
        lifecycle_mode: String(bundle.lifecycle.current_mode ?? "unknown"),
        display_name: String(bundle.profile?.display_name ?? this.statusIdentityField(bundle, "display_name") ?? "identity"),
        context_depth: String(bundle.profile?.current_context_depth ?? this.statusIdentityField(bundle, "context_depth") ?? "unknown"),
        readiness_score: (bundle.readiness as { overall_score?: number } | null)?.overall_score ?? null,
        active_routes: Object.keys(routes),
        inactive_future_routes: this.inactiveRoutes(bundle),
      },
      selected: {
        route: routeId,
        agent_id: agentId,
        trust_required: route?.trust_required ?? "unspecified",
        reason: this.routeReason(routeId, input),
      },
      agent: {
        id: agentId,
        class: agent.class,
        prompt_ref: promptRef,
        prompt: this.withRuntimeUserFacingGuard(prompt),
        tools: ((agent.tools as string[] | undefined) ?? []).slice(0, 12),
        authority_limits: agent.authority_limits ?? [],
        output_contract_name: outputContractName,
        output_contract: outputContracts?.[outputContractName] ?? null,
      },
      response_rules: {
        user_facing: true,
        posture: this.responsePosture(bundle, input, access),
        do_not_expose: [
          "internal routes",
          "decision.routing.next",
          "contract fields",
          "facet names",
          "tool names",
          "token class",
          "repository paths",
          "raw manifest JSON",
        ],
        safe_default:
          "Answer naturally as the identity in its current maturity. Ask only the smallest useful next question. Route authority-bearing actions to review.",
      },
    };
  }

  private responsePosture(bundle: IdentityBundle, input: PrepareInboundInput, access: Record<string, unknown>): Record<string, unknown> {
    const lifecycleMode = String(bundle.lifecycle.current_mode ?? "unknown");
    const lowInformation = this.isLowInformation(input.message);
    const riskDetected = this.hasRisk(input.message);
    const ownerSetupIntent = this.hasOwnerSetupIntent(input.message);
    const tokenClass = String(access.token_class);

    if (tokenClass === "public") {
      return {
        name: "public_minimal",
        style: "brief_public_safe",
        owner_verification: "not_available",
        user_goal: "Provide only public-safe identity information when the identity lifecycle allows it.",
        ask: "Ask what they want to know or do, without exposing private setup state.",
        avoid: ["owner onboarding", "identity configuration", "private context", "internal state"],
      };
    }

    if (riskDetected) {
      return {
        name: "risk_or_authority_review",
        style: "calm_boundary_and_next_step",
        owner_verification: "required_before_authority_action",
        user_goal: "Acknowledge the request, gather only necessary non-sensitive context, and route authority-bearing work to review.",
        ask: "Ask for the smallest safe detail needed to understand the request.",
        avoid: ["committing to refunds", "sending externally", "pricing", "scheduling", "activation", "credential handling"],
      };
    }

    if (lifecycleMode.includes("seed") && lowInformation) {
      return {
        name: "seed_warm_clarification",
        style: "brief_warm_plain_language",
        owner_verification: "not_required_for_greeting_or_safe_clarification",
        user_goal: "Help the user choose a safe next step without making ownership the first requirement.",
        ask: "What would you like help with first?",
        safe_options: [
          "tell me what this identity should become",
          "ask what I can do right now",
          "give me a simple task or question",
        ],
        mention_boundary: "Keep it light: say that changes, sends, payments, publishing, or setup approvals require verification only if relevant.",
        avoid: ["asking owner status first", "technical setup details", "internal route names", "structured contract-style output"],
      };
    }

    if (lifecycleMode.includes("seed") && ownerSetupIntent && !input.owner_verified) {
      return {
        name: "seed_owner_context_without_authority",
        style: "warm_context_collection",
        owner_verification: "required_before_accepting_configuration_as_authoritative",
        user_goal: "Collect intent and context as provisional, without treating it as approved owner configuration.",
        ask: "Ask for the desired outcome in plain language.",
        avoid: ["technical setup questions", "accepting approval", "activating capabilities"],
      };
    }

    return {
      name: "identity_default_intake",
      style: "natural_identity_response",
      owner_verification: input.owner_verified ? "verified_by_runtime_context" : "not_required_until_authority_boundary",
      user_goal: "Respond naturally according to identity guidance and ask only the smallest useful next question.",
      ask: "Ask the next question implied by the identity route and current request.",
      avoid: ["internal mechanics", "overclaiming capability", "unnecessary ownership checks"],
    };
  }

  private selectRoute(bundle: IdentityBundle, routes: Record<string, Record<string, unknown>>, input: PrepareInboundInput): string {
    const available = new Set(Object.keys(routes));
    if (this.hasRisk(input.message) && available.has("human_review")) return "human_review";
    if (!input.owner_verified && this.hasOwnerSetupIntent(input.message) && available.has("clarify_intent")) return "clarify_intent";
    if (input.owner_verified && this.hasOwnerSetupIntent(input.message) && available.has("owner_onboarding")) return "owner_onboarding";
    if (this.isLowInformation(input.message) && available.has("clarify_intent")) return "clarify_intent";
    for (const preferred of ["intake", "support", "customer_support", "sales", "owner_onboarding", "clarify_intent", "stop"]) {
      if (available.has(preferred)) return preferred;
    }
    return Object.keys(routes)[0] ?? (this.firstActiveAgent(bundle) ? "direct_agent" : "stop");
  }

  private routeReason(route: string, input: PrepareInboundInput): string {
    if (route === "human_review") return "Inbound appears to involve authority, risk, or external-effect boundaries.";
    if (route === "clarify_intent") return "Inbound can be handled with safe clarification before any authority boundary.";
    if (route === "owner_onboarding") return input.owner_verified ? "Verified owner setup/onboarding route is available." : "Seed-safe owner orientation route is available.";
    return "Selected from active identity routes.";
  }

  private isLowInformation(message: string | undefined): boolean {
    const value = (message ?? "").trim();
    if (!value) return true;
    return value.split(/\s+/).length <= 4 && !this.hasRisk(value) && !this.hasOwnerSetupIntent(value);
  }

  private hasRisk(message: string | undefined): boolean {
    const value = (message ?? "").toLowerCase();
    return RISK_PATTERNS.some((pattern) => value.includes(pattern));
  }

  private hasOwnerSetupIntent(message: string | undefined): boolean {
    const value = (message ?? "").toLowerCase();
    return OWNER_SETUP_PATTERNS.some((pattern) => value.includes(pattern));
  }

  private compactMessage(message: string | undefined): string {
    const value = (message ?? "").trim();
    if (!value) return "No inbound message content provided.";
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }

  private firstActiveAgent(bundle: IdentityBundle): string | undefined {
    const agents = (bundle.agents_registry.agents as Record<string, unknown>[] | undefined) ?? [];
    return agents.find((agent) => agent.status === "active")?.id as string | undefined;
  }

  private inactiveRoutes(bundle: IdentityBundle): string[] {
    const dispatch = bundle.dispatch_map;
    const activeMode = String(dispatch.active_lifecycle_mode ?? bundle.lifecycle.current_mode ?? "unknown");
    const lifecycleModes = dispatch.lifecycle_modes as Record<string, { inactive_proposed_future_routes?: string[] }> | undefined;
    return lifecycleModes?.[activeMode]?.inactive_proposed_future_routes ?? [];
  }

  private statusIdentityField(bundle: IdentityBundle, key: string): unknown {
    const identity = bundle.status?.identity;
    return identity && typeof identity === "object" ? (identity as Record<string, unknown>)[key] : undefined;
  }

  private withRuntimeUserFacingGuard(prompt: string | null): string {
    if (!prompt) return "not_available";
    return `${prompt.trim()}\n\n# Runtime User-Facing Guard\n\nUse internal routes, contracts, facets, tool names, and policy fields to decide behavior, but do not print them in the final user-facing response unless the user is clearly asking as an owner/admin for implementation details.`;
  }

  private accessPosture(auth: AuthPrincipal | undefined): Record<string, unknown> {
    const tokenClass = auth?.tokenClass ?? "unknown";
    const ownerCapable = tokenClass === "owner_runtime" || tokenClass === "admin";
    return {
      token_class: tokenClass,
      principal_id: auth?.id ?? "unknown",
      runtime_authority:
        tokenClass === "admin"
          ? "admin"
          : tokenClass === "owner_runtime"
            ? "owner_runtime"
            : tokenClass === "runtime"
              ? "runtime"
              : tokenClass === "readonly"
                ? "readonly"
                : tokenClass === "public"
                  ? "public"
                  : "unknown",
      owner_capable_credential: ownerCapable,
      owner_verified_by_credential: tokenClass === "owner_runtime",
      interpretation:
        tokenClass === "admin"
          ? "Credential can administer SemFS, but inbound user is not owner-verified unless runtime context says so."
          : tokenClass === "owner_runtime"
            ? "Credential represents an owner-authorized runtime."
            : tokenClass === "runtime"
              ? "Credential represents a trusted runtime, not an owner-verified inbound user."
              : tokenClass === "readonly"
                ? "Credential can inspect identity state but should not write or take authority-bearing actions."
                : "Public or unknown access: expose only public-safe behavior.",
    };
  }
}
