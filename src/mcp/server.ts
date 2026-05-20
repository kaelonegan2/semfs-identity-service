import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SemfsContainer } from "../services/container.js";
import { AuthPrincipal, AuthScope } from "../types/core.js";

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export function createMcpServer(container: SemfsContainer, principal?: AuthPrincipal): McpServer {
  const server = new McpServer({ name: "semfs", version: "0.1.0" });
  const activePrincipal = principal ?? container.config.authPrincipals[0] ?? { id: "public", tokenClass: "public" as const, scopes: [] };

  function has(scope: AuthScope): boolean {
    return container.auth.hasScope(activePrincipal, scope);
  }

  function canUse(toolName: string, scope: AuthScope): boolean {
    return has(scope) && container.auth.canUseTool(activePrincipal, toolName);
  }

  function canUseAny(toolName: string, scopes: AuthScope[]): boolean {
    return scopes.some((scope) => has(scope)) && container.auth.canUseTool(activePrincipal, toolName);
  }

  async function load(identityId: string) {
    const mount = container.registry.resolve(identityId);
    const bundle = await container.loader.load(mount);
    return { mount, bundle };
  }

  if (canUse("semfs_initialize_identity", "identity:initialize")) server.tool(
    "semfs_initialize_identity",
    "Initialize a target repo with the business-neutral SemFS seed identity template.",
    {
      identity_id: z.string(),
      display_name: z.string().optional(),
      owner_placeholder: z.string().optional(),
      overwrite_mode: z.enum(["refuse", "replace_seed_files"]).optional(),
    },
    async (args) => text(await container.seedTemplates.initialize(args))
  );

  if (canUse("semfs_get_identity_status", "identity:status")) server.tool(
    "semfs_get_identity_status",
    "Check whether a SemFS identity is ready, uninitialized, or incomplete without requiring the full manifest to load.",
    { identity_id: z.string().default(container.config.defaultIdentityId) },
    async ({ identity_id }) => {
      const mount = container.registry.resolve(identity_id);
      const status = await container.loader.status(mount);
      const extra = status.state === "ready" ? { memory: container.vectors.status(await container.loader.load(mount)) } : { memory: container.vectors.status(null) };
      return text(container.auth.statusResponse(status, activePrincipal, extra));
    }
  );

  if (canUse("semfs_prepare_inbound", "inbound:prepare")) server.tool(
    "semfs_prepare_inbound",
    "Prepare a compact identity-aware runtime packet for an arbitrary inbound message.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      message: z.string().optional(),
      conversation_id: z.string().nullable().optional(),
      run_id: z.string().optional(),
      runtime_capabilities: z.record(z.unknown()).optional(),
      runtime_tools: z.array(z.string()).optional(),
      owner_verified: z.boolean().optional(),
      trust_level: z.string().optional(),
      risk_detected: z.boolean().optional(),
      risk_category: z.string().optional(),
      intent: z.string().optional(),
      decision: z.string().optional(),
      context_kind: z.string().optional(),
      pending_identity_context: z.boolean().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const mount = container.registry.resolve(identity_id);
      return text(await container.inbound.prepare(mount, { ...rest, auth: activePrincipal }));
    }
  );

  if (canUse("semfs_get_manifest", "identity:read")) server.tool(
    "semfs_get_manifest",
    "Read the SemFS identity manifest and active runtime surface.",
    { identity_id: z.string().default(container.config.defaultIdentityId) },
    async ({ identity_id }) => {
      const { mount, bundle } = await load(identity_id);
      return text({ mount: { identity_id: mount.identityId, store: mount.store.label }, manifest: container.loader.manifest(bundle) });
    }
  );

  if (canUse("semfs_get_identity_map", "identity:read")) server.tool(
    "semfs_get_identity_map",
    "Read identity-map traversal guidance and SemFS operation coverage for each identity area.",
    { identity_id: z.string().default(container.config.defaultIdentityId) },
    async ({ identity_id }) => {
      const { mount, bundle } = await load(identity_id);
      return text({ mount: { identity_id: mount.identityId, store: mount.store.label }, identity_map: container.loader.identityMap(bundle) });
    }
  );

  if (canUseAny("semfs_apply_owner_identity_seed", ["identity:profile_write", "identity:seed_update"])) server.tool(
    "semfs_apply_owner_identity_seed",
    "Apply verified-owner seed identity direction to canonical profile, brief, README, and status surfaces. This does not activate capabilities, external actions, credentials, payments, publishing, or lifecycle changes.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      display_name: z.string().optional(),
      represented_entity: z.string().optional(),
      primary_purpose: z.string().optional(),
      business_or_function_domain: z.string().optional(),
      audience_or_market: z.string().optional(),
      profile_summary: z.string().optional(),
      voice_summary: z.string().optional(),
      owner_instruction: z.string().optional(),
      tone: z.array(z.string()).optional(),
      conversation_id: z.string().nullable().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const mount = container.registry.resolve(identity_id);
      return text(await container.identityProfile.applyOwnerIdentitySeed(mount, activePrincipal, rest));
    }
  );

  if (canUse("semfs_apply_voice_profile_update", "identity:profile_write")) server.tool(
    "semfs_apply_voice_profile_update",
    "Apply an owner-approved voice, tone, and style update without activating capabilities.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      voice_summary: z.string(),
      tone: z.array(z.string()).optional(),
      style_guidance: z.array(z.string()).optional(),
      avoid: z.array(z.string()).optional(),
      approval_ref: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const mount = container.registry.resolve(identity_id);
      return text(await container.maturation.applyVoiceProfileUpdate(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_apply_domain_context", "identity:profile_write")) server.tool(
    "semfs_apply_domain_context",
    "Apply owner-approved domain, audience, and operating-area context.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      business_or_function_domain: z.string(),
      audience_or_market: z.string().optional(),
      operating_area: z.string().optional(),
      domain_summary: z.string().optional(),
      approval_ref: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const mount = container.registry.resolve(identity_id);
      return text(await container.maturation.applyDomainContext(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_apply_offer_catalog_update", "identity:profile_write")) server.tool(
    "semfs_apply_offer_catalog_update",
    "Apply an owner-approved offer or service catalog without creating pricing or scheduling authority.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      catalog_id: z.string().optional(),
      offers: z.array(z.string()),
      pricing_posture: z.string().optional(),
      authority_notes: z.string().optional(),
      approval_ref: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const mount = container.registry.resolve(identity_id);
      return text(await container.maturation.applyOfferCatalogUpdate(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_get_agent", "agent:read")) server.tool(
    "semfs_get_agent",
    "Retrieve an internal identity agent manifest with prompt, tools, policies, contracts, skills, specialists, and memory access.",
    { identity_id: z.string().default(container.config.defaultIdentityId), agent_id: z.string() },
    async ({ identity_id, agent_id }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.agents.getAgent(mount, bundle, agent_id));
    }
  );

  if (canUse("semfs_prepare_agent_action", "agent:prepare")) server.tool(
    "semfs_prepare_agent_action",
    "Prepare contract and prep for an outside runtime to act as an identity agent.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      agent_id: z.string(),
      message_summary: z.string().optional(),
      conversation_id: z.string().nullable().optional(),
      route: z.string().optional(),
      owner_verified: z.boolean().optional(),
      trust_level: z.string().optional(),
    },
    async ({ identity_id, agent_id, owner_verified, trust_level, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.agents.prepareAction(mount, bundle, agent_id, { ...rest, trust: { owner_verified, trust_level } }));
    }
  );

  if (canUse("semfs_authorize_agent_action", "agent:authorize")) server.tool(
    "semfs_authorize_agent_action",
    "Authorize a requested tool or action as a specific identity agent.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      agent_id: z.string(),
      requested_tool: z.string().optional(),
      action_type: z.string().optional(),
    },
    async ({ identity_id, agent_id, ...rest }) => {
      const { bundle } = await load(identity_id);
      return text(container.agents.authorizeAction(bundle, agent_id, rest));
    }
  );

  if (canUse("semfs_validate_agent_output", "agent:validate")) server.tool(
    "semfs_validate_agent_output",
    "Validate an agent output against its output contract, route policy, and facet policy.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      agent_id: z.string(),
      output_json: z.string(),
    },
    async ({ identity_id, agent_id, output_json }) => {
      const { bundle } = await load(identity_id);
      return text(container.agents.validateOutput(bundle, agent_id, JSON.parse(output_json) as Record<string, unknown>));
    }
  );

  if (canUse("semfs_record_runtime_capabilities", "runtime:capability_write")) server.tool(
    "semfs_record_runtime_capabilities",
    "Record the runtime's observed execution capabilities for a specific conversation/run.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string(),
      run_id: z.string(),
      runtime_capabilities: z.record(z.unknown()),
      runtime_tools: z.array(z.string()).optional(),
      notes: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.runtime.recordRuntimeCapabilities(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_prepare_orchestration_run", "run:orchestrate")) server.tool(
    "semfs_prepare_orchestration_run",
    "Prepare an owner-aware orchestration run using a recorded runtime capability snapshot.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string(),
      run_id: z.string(),
      owner_verified: z.boolean().optional(),
      runtime_capabilities: z.record(z.unknown()).optional(),
      runtime_tools: z.array(z.string()).optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.runtime.prepareOrchestrationRun(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_prepare_subagent_run", "run:orchestrate")) server.tool(
    "semfs_prepare_subagent_run",
    "Prepare a scoped sub-agent run and return an ephemeral agent-runtime grant.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string(),
      run_id: z.string(),
      agent_id: z.string(),
      subagent_type: z.enum(["inline_subagent", "parallel_subagent", "continuation_subagent"]),
      inbound_type: z.string(),
      ttl_seconds: z.number(),
      owner_verified: z.boolean().optional(),
      request_direct_response: z.boolean().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.runtime.prepareSubagentRun(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_record_agent_run_event", "run:record")) server.tool(
    "semfs_record_agent_run_event",
    "Record an audit event for a parent or sub-agent run.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string(),
      run_id: z.string(),
      event_id: z.string().optional(),
      agent_id: z.string().optional(),
      event_type: z.string(),
      details: z.record(z.unknown()).optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.runtime.recordAgentRunEvent(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_record_agent_run_result", "run:record")) server.tool(
    "semfs_record_agent_run_result",
    "Record a result for a parent or sub-agent run.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string(),
      run_id: z.string(),
      result_id: z.string().optional(),
      agent_id: z.string().optional(),
      status: z.string(),
      output: z.record(z.unknown()).optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.runtime.recordAgentRunResult(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_record_owner_context", "context:write")) server.tool(
    "semfs_record_owner_context",
    "Record owner-verified context as captured, non-activated identity maturation input.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string(),
      context_id: z.string().optional(),
      summary: z.string(),
      details: z.record(z.unknown()).optional(),
      owner_verified: z.boolean().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.runtime.recordOwnerContext(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_record_inbound_context", "context:write")) server.tool(
    "semfs_record_inbound_context",
    "Record safe inbound context as captured, non-authoritative context.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string(),
      context_id: z.string().optional(),
      summary: z.string(),
      details: z.record(z.unknown()).optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.runtime.recordInboundContext(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_record_capability_gap", "evolution:write")) server.tool(
    "semfs_record_capability_gap",
    "Record a schema-backed capability gap without activating the missing capability.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      gap_id: z.string().optional(),
      source_agent: z.string().optional(),
      gap: z.string(),
      blocked_action: z.string(),
      safe_default: z.string(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.runtime.recordCapabilityGap(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_create_capability_proposal", "evolution:write")) server.tool(
    "semfs_create_capability_proposal",
    "Create a schema-backed inactive capability proposal.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      proposal_id: z.string().optional(),
      source_agent: z.string().optional(),
      name: z.string(),
      summary: z.string(),
      activation_requirements: z.array(z.string()).optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.runtime.createCapabilityProposal(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_link_approval_to_artifact", "approval:write")) server.tool(
    "semfs_link_approval_to_artifact",
    "Link an approval decision to the exact artifact reviewed without activating capability.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      link_id: z.string().optional(),
      decision_id: z.string(),
      artifact_ref: z.string(),
      approval_status: z.string(),
      note: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.runtime.linkApprovalToArtifact(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_record_knowledge_draft", "context:write")) server.tool(
    "semfs_record_knowledge_draft",
    "Record a draft knowledge item for later review; this does not make it authoritative.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      draft_id: z.string().optional(),
      title: z.string(),
      summary: z.string(),
      items: z.array(z.string()).optional(),
      source_basis: z.array(z.string()).optional(),
      review_questions: z.array(z.string()).optional(),
      safe_default: z.string().optional(),
      source_agent: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.maturation.recordKnowledgeDraft(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_promote_knowledge_draft", "approval:write")) server.tool(
    "semfs_promote_knowledge_draft",
    "Promote a reviewed knowledge draft into canonical approved knowledge.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      draft_id: z.string(),
      knowledge_id: z.string().optional(),
      approval_ref: z.string(),
      approved_by_role: z.string().optional(),
      source_agent: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.maturation.promoteKnowledgeDraft(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_record_research_source", "context:write")) server.tool(
    "semfs_record_research_source",
    "Record a source-backed research note without treating it as final identity truth.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      source_id: z.string().optional(),
      title: z.string(),
      url: z.string().optional(),
      summary: z.string(),
      confidence: z.string().optional(),
      relevance: z.string().optional(),
      review_status: z.string().optional(),
      source_agent: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.maturation.recordResearchSource(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_resolve_review_packet", "approval:write")) server.tool(
    "semfs_resolve_review_packet",
    "Resolve a review packet with a decision, without implicitly activating capability.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      resolution_id: z.string().optional(),
      review_packet_ref: z.string(),
      decision: z.string(),
      reviewer: z.string().optional(),
      summary: z.string().optional(),
      allowed_next_operations: z.array(z.string()).optional(),
      blocked_operations: z.array(z.string()).optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.maturation.resolveReviewPacket(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_get_budget_posture", "governance:read")) server.tool(
    "semfs_get_budget_posture",
    "Evaluate current usage against identity governance budget thresholds.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      usage: z.record(z.unknown()).optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.maturation.getBudgetPosture(mount, rest));
    }
  );

  if (canUse("semfs_create_credential_binding_request", "review:write")) server.tool(
    "semfs_create_credential_binding_request",
    "Create a non-secret credential binding request for owner review.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      request_id: z.string().optional(),
      capability: z.string(),
      credential_alias: z.string(),
      requested_scopes: z.array(z.string()).optional(),
      risk: z.string().optional(),
      source_agent: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.maturation.createCredentialBindingRequest(mount, rest, activePrincipal));
    }
  );

  if (canUse("semfs_activate_agent", "activation:write")) server.tool(
    "semfs_activate_agent",
    "Activate an approved agent in the canonical registry after dependency checks.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      agent_id: z.string(),
      approval_ref: z.string(),
      proposal_id: z.string().optional(),
      prompt_ref: z.string().optional(),
      output_contract: z.string().optional(),
      facet_target: z.string().optional(),
      tools: z.array(z.string()).optional(),
      authority_limits: z.array(z.string()).optional(),
      eval_refs: z.array(z.string()).optional(),
      runtime_availability: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.maturation.activateAgent(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_activate_route", "activation:write")) server.tool(
    "semfs_activate_route",
    "Activate an approved dispatch route after its agent is active.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      route: z.string(),
      agent_id: z.string(),
      approval_ref: z.string(),
      proposal_id: z.string().optional(),
      output_contract: z.string().optional(),
      facet_target: z.string().optional(),
      trust_required: z.string().optional(),
      eval_refs: z.array(z.string()).optional(),
      runtime_availability: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount, bundle } = await load(identity_id);
      return text(await container.maturation.activateRoute(mount, bundle, rest, activePrincipal));
    }
  );

  if (canUse("semfs_prepare_dream", "dream:prepare")) server.tool(
    "semfs_prepare_dream",
    "Prepare a bounded autonomous maturation evaluation packet.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      scope: z.enum(["profile", "knowledge", "capabilities", "authority", "memory", "agents", "tools", "specialists", "skills", "all"]).default("all"),
      goal: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { bundle } = await load(identity_id);
      return text(container.dreams.prepare(bundle, rest));
    }
  );

  if (canUse("semfs_validate_dream", "dream:validate")) server.tool("semfs_validate_dream", "Validate dream findings before safe writeback.", { findings_json: z.string() }, async ({ findings_json }) =>
    text(container.dreams.validate(JSON.parse(findings_json)))
  );

  if (canUse("semfs_write_safe_dream_outputs", "dream:write")) server.tool(
    "semfs_write_safe_dream_outputs",
    "Write validated safe dream findings as SemFS artifacts.",
    { identity_id: z.string().default(container.config.defaultIdentityId), findings_json: z.string() },
    async ({ identity_id, findings_json }) => {
      const { mount } = await load(identity_id);
      return text(await container.dreams.writeSafe(mount, JSON.parse(findings_json)));
    }
  );

  if (canUse("semfs_get_memory_status", "memory:search")) server.tool(
    "semfs_get_memory_status",
    "Inspect SemFS memory backend configuration, durability, namespace policy, and privacy posture.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
    },
    async ({ identity_id }) => {
      const { bundle } = await load(identity_id);
      return text({ identity_id: bundle.identity_id, memory: container.vectors.status(bundle) });
    }
  );

  if (canUse("semfs_vector_search", "memory:search")) server.tool(
    "semfs_vector_search",
    "Search policy-filtered SemFS vector summaries.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      namespace: z.string(),
      query: z.string(),
      max_records: z.number().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { bundle } = await load(identity_id);
      container.auth.requireVectorNamespace(activePrincipal, rest.namespace);
      return text(await container.vectors.search(bundle, rest));
    }
  );

  if (canUse("semfs_vector_upsert", "memory:write")) server.tool(
    "semfs_vector_upsert",
    "Write a policy-checked SemFS vector summary to an allowed namespace.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      namespace: z.string(),
      summary: z.string(),
      record_id: z.string().optional(),
      content_ref: z.string().optional(),
      privacy_class: z.string().optional(),
      source_agent: z.string().optional(),
      retrieval_tags: z.array(z.string()).optional(),
      source_path: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { bundle } = await load(identity_id);
      container.auth.requireVectorNamespace(activePrincipal, rest.namespace);
      return text(await container.vectors.upsert(bundle, rest));
    }
  );

  if (canUse("semfs_write_safe_artifact", "artifact:safe_write")) server.tool(
    "semfs_write_safe_artifact",
    "Write a safe SemFS artifact to an allowlisted path. This cannot write lifecycle, registry, dispatch, security, credential, or payment paths.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      path: z.string(),
      content: z.string(),
      message: z.string().optional(),
    },
    async ({ identity_id, path, content, message }) => {
      const { mount } = await load(identity_id);
      return text(await container.writer.writeSafe(mount, path, content, message));
    }
  );

  if (canUse("semfs_create_review_packet", "review:write")) server.tool(
    "semfs_create_review_packet",
    "Create a safe human/owner review packet artifact.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      conversation_id: z.string().optional(),
      summary: z.string().optional(),
      decision_needed: z.string().optional(),
      safe_default: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.writer.createReviewPacket(mount, rest));
    }
  );

  if (canUse("semfs_capture_approval", "approval:write")) server.tool(
    "semfs_capture_approval",
    "Capture an owner or reviewer approval result without activating capabilities.",
    {
      identity_id: z.string().default(container.config.defaultIdentityId),
      decision_id: z.string().optional(),
      approval_status: z.string().optional(),
      reviewer: z.string().optional(),
      summary: z.string().optional(),
    },
    async ({ identity_id, ...rest }) => {
      const { mount } = await load(identity_id);
      return text(await container.writer.captureApproval(mount, rest));
    }
  );

  return server;
}
