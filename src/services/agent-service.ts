import { AgentActionRequest } from "../types/core.js";
import { badRequest, forbidden } from "../utils/errors.js";
import { IdentityBundle } from "./identity-loader.js";
import { PolicyService } from "./policy-service.js";
import { readOptionalText } from "./json.js";
import { IdentityMount } from "../types/core.js";

export class AgentService {
  constructor(private readonly policy: PolicyService) {}

  listAgents(bundle: IdentityBundle): Record<string, unknown> {
    return {
      identity_id: bundle.identity_id,
      agents: bundle.agents_registry.agents ?? [],
      inactive_future_agents: bundle.agents_registry.inactive_future_agents ?? [],
      roles_are_not_agents: true,
      roles_ref: "identity_state/authority/roles.md",
    };
  }

  async getAgent(mount: IdentityMount, bundle: IdentityBundle, agentId: string): Promise<Record<string, unknown>> {
    const agent = this.policy.agentRecord(bundle, agentId);
    const promptRef = String(agent.prompt_ref ?? "");
    const promptText = promptRef ? await readOptionalText(mount.store, promptRef) : null;
    const outputContractName = String(agent.output_contract ?? "");
    const outputContracts = bundle.output_contracts.contracts as Record<string, unknown> | undefined;
    const facetTarget = String(agent.facet_target ?? "");
    const facetPolicy = (bundle.facet_policy.facets as Record<string, unknown> | undefined)?.[facetTarget] ?? null;

    return {
      identity_id: bundle.identity_id,
      agent,
      executable_agent: agent.status === "active",
      roles_are_not_agents: true,
      prompt: {
        prompt_ref: promptRef,
        system: this.withRuntimeUserFacingGuard(promptText),
        user: "not_available",
        note: "Seed repos may store one durable prompt file. SemFS exposes system/user slots so matured identities can separate them.",
      },
      tools: this.policy.toolsForAgent(bundle, agentId),
      output_contract: outputContracts?.[outputContractName] ?? null,
      output_contract_name: outputContractName,
      facet_target: facetTarget,
      facet_policy: facetPolicy,
      policies: {
        mode_permissions: bundle.mode_permissions,
        authority_roles: bundle.roles_markdown,
        authority: bundle.authority_markdown,
        orchestration: bundle.orchestration_policy_markdown,
      },
      skills: bundle.skills_markdown ?? "not_available",
      specialists: bundle.specialists ?? { specialists: [], proposed_inactive: [] },
      memory: bundle.vector_namespaces,
      blocked_actions: bundle.tools_registry.prohibited_until_approved_or_bound ?? [],
    };
  }

  async prepareAction(
    mount: IdentityMount,
    bundle: IdentityBundle,
    agentId: string,
    input: AgentActionRequest
  ): Promise<Record<string, unknown>> {
    const manifest = await this.getAgent(mount, bundle, agentId);
    const agent = manifest.agent as Record<string, unknown>;
    if (agent.status !== "active") throw forbidden(`Agent is not active: ${agentId}`);

    const lifecycleMode = String(bundle.lifecycle.current_mode ?? "unknown");
    const readiness = bundle.readiness as { overall_score?: number } | null;
    const trust = input.trust ?? {};
    const route = input.route ?? String(agent.output_contract ?? "stop");
    const contract = {
      ctx: {
        identity_id: bundle.identity_id,
        conversation_id: input.conversation_id ?? null,
      },
      msg: {
        summary: input.message_summary ?? "unknown",
        raw_ref: null,
      },
      decision: {
        routing: { next: route },
      },
      orchestration: {
        stage: "agent_action",
        selected_agent: agentId,
      },
      facets: input.facets ?? {},
      outbound: {},
      audit: {},
    };

    const prep = {
      identity: {
        lifecycle_mode: lifecycleMode,
        readiness_score: readiness?.overall_score ?? null,
        known_profile_summary: this.profileSummary(bundle),
      },
      conversation: {
        current_status: "new_agent_action",
      },
      authority: {
        owner_verified: Boolean(trust.owner_verified),
        trust_level: trust.trust_level ?? (trust.owner_verified ? "verified_owner" : "unverified_external"),
        approval_state: trust.approval_state ?? "not_available",
      },
      usage: {
        budget_state: "not_metered_by_semfs_v1",
      },
      vector_context: {
        allowed_summaries: [],
      },
      available_tools: this.policy.toolsForAgent(bundle, agentId).map((tool) => tool.id),
      output_contract: manifest.output_contract,
      prompt_guidance: {
        prompt_ref: (manifest.prompt as Record<string, unknown>).prompt_ref,
        prompt: manifest.prompt,
      },
    };

    return { identity_id: bundle.identity_id, agent_id: agentId, contract, prep, manifest };
  }

  authorizeAction(bundle: IdentityBundle, agentId: string, input: AgentActionRequest): Record<string, unknown> {
    this.policy.rejectActivationLike(input.action_type);
    if (input.requested_tool) {
      const result = this.policy.authorizeTool(bundle, agentId, input.requested_tool);
      return { identity_id: bundle.identity_id, agent_id: agentId, ...result };
    }
    if (!input.action_type) throw badRequest("requested_tool or action_type is required");
    return { identity_id: bundle.identity_id, agent_id: agentId, allowed: true, action_type: input.action_type };
  }

  validateOutput(bundle: IdentityBundle, agentId: string, output: Record<string, unknown>): Record<string, unknown> {
    return this.policy.validateOutput(bundle, agentId, output);
  }

  private profileSummary(bundle: IdentityBundle): string {
    const profile = bundle.profile;
    if (!profile) return "unknown";
    return [
      `display_name=${String(profile.display_name ?? "unknown")}`,
      `purpose=${String(profile.primary_purpose ?? "unknown")}`,
      `domain=${String(profile.business_or_function_domain ?? "unknown")}`,
      `audience=${String(profile.audience_or_market ?? "unknown")}`,
    ].join("; ");
  }

  private withRuntimeUserFacingGuard(promptText: string | null): string {
    if (!promptText) return "not_available";
    return `${promptText.trim()}\n\n${runtimeGuidanceOverlay()}`;
  }
}

export function runtimeGuidanceOverlay(): string {
  return `# Runtime User-Facing Guard

Use internal routes, contracts, facets, tool names, and policy fields to decide behavior, but do not print them in the final user-facing response unless the user is clearly asking as an owner/admin for implementation details.

# Current SemFS Runtime Guidance Overlay

Write naturally by default. Do not force "Recommendation / Why / Decision Needed / Safe Default / Next Safe Step" for intimate setup, identity-formation, or owner-persona requests unless labels genuinely help the owner act.

For verified-owner seed identity formation, if a canonical owner identity seed update tool is available and the owner gives enough direction or accepts a default, use it before generic conversation artifacts or vector memory. This updates canonical profile, brief, README, and status surfaces. It does not activate external actions, credentials, payments, publishing, capabilities, tools, agents, specialists, policies, or lifecycle changes.`;
}
