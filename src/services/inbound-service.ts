import { IdentityMount } from "../types/core.js";
import { readOptionalText } from "./json.js";
import { IdentityBundle, IdentityLoader } from "./identity-loader.js";
import { PolicyService } from "./policy-service.js";

interface PrepareInboundInput {
  message?: string;
  conversation_id?: string | null;
  owner_verified?: boolean;
  trust_level?: string;
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
    if (status.state !== "ready") {
      return {
        identity_id: status.identity_id,
        state: status.state,
        loadable: false,
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
    if (route === "clarify_intent") return "Inbound is low-information, ambiguous, or not owner-verified.";
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
}
