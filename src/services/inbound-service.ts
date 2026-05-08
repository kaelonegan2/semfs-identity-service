import { AuthPrincipal, IdentityMount } from "../types/core.js";
import { readOptionalText } from "./json.js";
import { IdentityBundle, IdentityLoader } from "./identity-loader.js";
import { PolicyService } from "./policy-service.js";
import { runtimeGuidanceOverlay } from "./agent-service.js";

interface PrepareInboundInput {
  message?: string;
  conversation_id?: string | null;
  owner_verified?: boolean;
  trust_level?: string;
  risk_detected?: boolean;
  risk_category?: string;
  intent?: string;
  decision?: string;
  context_kind?: string;
  pending_identity_context?: boolean;
  auth?: AuthPrincipal;
}

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
    const routeId = this.selectRoute(bundle, routes, input, access);
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
        risk_detected: Boolean(input.risk_detected),
        risk_category: input.risk_category ?? null,
        owner_verified: this.effectiveOwnerVerified(input, access),
        owner_verified_from_runtime_context: Boolean(input.owner_verified),
        trust_level: input.trust_level ?? (this.effectiveOwnerVerified(input, access) ? "verified_owner" : "unverified"),
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
        reason: this.routeReason(routeId, input, access),
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
        action_guidance: this.actionGuidance(bundle, access),
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
    const riskDetected = Boolean(input.risk_detected);
    const tokenClass = String(access.token_class);
    const ownerVerified = this.effectiveOwnerVerified(input, access);

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

    if (lifecycleMode.includes("seed") && lowInformation && !this.isIdentityShaping(input) && !(ownerVerified && this.isApprovalContinuation(input))) {
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

    if (lifecycleMode.includes("seed") && tokenClass === "runtime") {
      return {
        name: "seed_expected_runtime_intake",
        style: "clear_early_state_plain_language",
        owner_verification: "runtime_is_expected_but_not_owner_authority",
        user_goal:
          "Respond as an initialized seed identity in an expected runtime. Explore the request safely, but do not treat identity-shaping input as a draft profile or approved configuration.",
        ask:
          "Ask the smallest useful question that helps understand the request. For identity-shaping requests, ask what the identity should understand first, while making clear that owner approval is required before it becomes part of the identity.",
        safe_options: [
          "explore what the identity could become",
          "explain what the seed can safely do now",
          "prepare questions or an owner review packet",
        ],
        mention_boundary:
          "Say the identity is still early and can explore direction now, but profile changes, authority, capabilities, sends, publishing, payments, and commitments require owner approval.",
        avoid: [
          "calling user input a draft profile",
          "saying changes can be applied after owner verification flow unless such a flow is actually exposed",
          "claiming mature capability is already active",
          "asking technical setup questions",
          "role-playing as permanent identity",
        ],
      };
    }

    if (lifecycleMode.includes("seed") && ownerVerified) {
      return {
        name: "seed_verified_owner_intake",
        style: "warm_capable_owner_setup",
        owner_verification: "verified_by_runtime_context_or_credential",
        user_goal:
          "Meet the owner as a collaborator shaping a living identity. Reflect the direction, offer a concrete next move, and keep durable changes draft and approval-aware.",
        ask:
          "Ask the smallest useful next question. For identity-shaping requests, offer to build from the owner's words, extract voice from examples, or prepare a research/exploration plan before drafting identity state.",
        safe_options: [
          "shape the identity from the owner's description",
          "map the public/business context first",
          "extract voice, judgment, priorities, and boundaries",
          "draft a reviewable identity brief and first memory notes",
        ],
        mention_boundary:
          "Keep setup collaborative and light. Durable profile or capability changes can be drafted now and applied through the identity's approval path.",
        avoid: ["technical setup questions", "claiming mature capability is already active", "external sends", "publishing", "payments"],
      };
    }

    if (lifecycleMode.includes("seed") && !ownerVerified) {
      return {
        name: "seed_unverified_or_readonly_intake",
        style: "warm_exploratory_boundary",
        owner_verification: "required_before_accepting_configuration_or_authority_as_authoritative",
        user_goal:
          "Explore the requested identity direction naturally while keeping one clear boundary: it cannot become authoritative identity state until owner approval is established.",
        ask:
          "Ask the smallest useful next question. If the request would shape the identity, offer exploration paths such as describing the person/business, mapping audience and work, or preparing a review packet.",
        safe_options: [
          "explore possible identity direction",
          "prepare questions for the owner",
          "map what research would be useful",
          "route authority-bearing work to review",
        ],
        avoid: [
          "calling user input a draft profile",
          "technical setup questions",
          "accepting approval",
          "activating capabilities",
          "role-playing as permanent identity",
        ],
      };
    }

    return {
      name: "identity_default_intake",
      style: "natural_identity_response",
      owner_verification: ownerVerified ? "verified_by_runtime_context_or_credential" : "not_required_until_authority_boundary",
      user_goal: "Respond naturally according to identity guidance and ask only the smallest useful next question.",
      ask: "Ask the next question implied by the identity route and current request.",
      avoid: ["internal mechanics", "overclaiming capability", "unnecessary ownership checks"],
    };
  }

  private actionGuidance(bundle: IdentityBundle, access: Record<string, unknown>): Record<string, unknown> {
    const lifecycleMode = String(bundle.lifecycle.current_mode ?? "unknown");
    const tokenClass = String(access.token_class);
    const ownerVerified = access.owner_verified_by_credential === true;

    if (lifecycleMode.includes("seed") && ownerVerified) {
      return {
        owner_input_capture: {
          applies_when:
            "The owner provides identity-shaping context, profile direction, voice/tone guidance, authority boundaries, or maturation preferences.",
          expectation:
            "Do not only reply. If the owner approves what the seed identity should be, use the canonical owner identity seed update path before generic artifacts or vector memory.",
          preferred_tools: ["semfs_apply_owner_identity_seed", "semfs_write_safe_artifact", "semfs_vector_upsert"],
          canonical_seed_update_tool: "semfs_apply_owner_identity_seed",
          canonical_profile_update: {
            applies_when:
              "The verified owner names or approves the identity's represented person, business, project, purpose, voice, or default seed persona.",
            approval_required: false,
            note:
              "Owner-runtime approval is enough for canonical seed profile, brief, README, and status updates. This does not activate capabilities, lifecycle changes, credentials, payments, publishing, or external actions.",
          },
          safe_artifact_target:
            "conversations/{conversation_id_or_generated_id}/current-status.md for conversation-scoped setup notes or review summaries.",
          vector_namespace: "owner-onboarding-summaries",
          constraints: [
            "Keep profile changes draft/reviewable until the identity approval path records them.",
            "Do not write lifecycle, registry, dispatch, security, credential, or payment changes.",
            "Do not activate capabilities or external actions.",
          ],
        },
      };
    }

    if (lifecycleMode.includes("seed") && tokenClass === "runtime") {
      return {
        runtime_context_capture: {
          applies_when: "The expected runtime receives useful exploratory identity direction but is not owner-authorized.",
          expectation: "Clarify and explore. Do not write authoritative profile or identity memory unless runtime policy explicitly permits it.",
          preferred_tools: ["semfs_create_review_packet"],
        },
      };
    }

    return {};
  }

  private selectRoute(
    bundle: IdentityBundle,
    routes: Record<string, Record<string, unknown>>,
    input: PrepareInboundInput,
    access: Record<string, unknown>
  ): string {
    const available = new Set(Object.keys(routes));
    const ownerVerified = this.effectiveOwnerVerified(input, access);
    const lifecycleMode = String(bundle.lifecycle.current_mode ?? "unknown");
    if (input.risk_detected && available.has("human_review")) return "human_review";
    if (lifecycleMode.includes("seed") && ownerVerified && this.isIdentityShaping(input) && available.has("owner_onboarding")) {
      return "owner_onboarding";
    }
    if (lifecycleMode.includes("seed") && ownerVerified && this.isApprovalContinuation(input) && available.has("owner_onboarding")) {
      return "owner_onboarding";
    }
    if (this.isLowInformation(input.message) && available.has("clarify_intent")) return "clarify_intent";
    if (lifecycleMode.includes("seed") && ownerVerified && available.has("owner_onboarding")) return "owner_onboarding";
    if (lifecycleMode.includes("seed") && !ownerVerified && available.has("clarify_intent")) return "clarify_intent";
    for (const preferred of ["intake", "support", "customer_support", "sales", "owner_onboarding", "clarify_intent", "stop"]) {
      if (available.has(preferred)) return preferred;
    }
    return Object.keys(routes)[0] ?? (this.firstActiveAgent(bundle) ? "direct_agent" : "stop");
  }

  private routeReason(route: string, input: PrepareInboundInput, access: Record<string, unknown>): string {
    if (route === "human_review") return "Inbound appears to involve authority, risk, or external-effect boundaries.";
    if (route === "clarify_intent") return "Inbound can be handled with safe clarification before any authority boundary.";
    if (route === "owner_onboarding")
      return this.effectiveOwnerVerified(input, access)
        ? "Verified owner setup/onboarding route is available."
        : "Seed-safe owner orientation route is available.";
    return "Selected from active identity routes.";
  }

  private isLowInformation(message: string | undefined): boolean {
    const value = (message ?? "").trim();
    if (!value) return true;
    return value.split(/\s+/).length <= 4;
  }

  private isIdentityShaping(input: PrepareInboundInput): boolean {
    const intent = String(input.intent ?? "");
    const contextKind = String(input.context_kind ?? "");
    return (
      ["identity_setup", "identity_profile_update", "owner_seed_profile", "voice_profile_update", "purpose_update"].includes(intent) ||
      ["identity_profile", "owner_profile", "voice_profile", "identity_purpose"].includes(contextKind)
    );
  }

  private isApprovalContinuation(input: PrepareInboundInput): boolean {
    return ["accept", "approve", "confirm"].includes(String(input.decision ?? "")) && (Boolean(input.conversation_id) || input.pending_identity_context === true);
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
    return `${prompt.trim()}\n\n${runtimeGuidanceOverlay()}`;
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

  private effectiveOwnerVerified(input: PrepareInboundInput, access: Record<string, unknown>): boolean {
    return Boolean(input.owner_verified) || access.owner_verified_by_credential === true;
  }
}
