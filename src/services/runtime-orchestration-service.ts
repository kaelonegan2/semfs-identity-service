import crypto from "node:crypto";
import { AgentRuntimeGrant, AuthPrincipal, AuthScope, IdentityMount, SubagentType } from "../types/core.js";
import { badRequest, forbidden } from "../utils/errors.js";
import { IdentityBundle } from "./identity-loader.js";
import { PolicyService } from "./policy-service.js";
import { SafeWriter } from "./safe-writer.js";
import { VectorService } from "./vector-service.js";
import { AuthService } from "./auth-service.js";

const CAPABILITY_KEYS = [
  "runtime_subagent_spawn",
  "runtime_subagent_parallel",
  "runtime_subagent_continuation",
  "scoped_agent_runtime_grant",
  "external_lookup",
  "subagent_direct_response",
] as const;

const SUBAGENT_TYPES = new Set<SubagentType>(["inline_subagent", "parallel_subagent", "continuation_subagent"]);

const TOOL_SCOPES: Record<string, AuthScope> = {
  semfs_get_identity_status: "identity:status",
  semfs_get_manifest: "identity:read",
  semfs_get_agent: "agent:read",
  semfs_prepare_agent_action: "agent:prepare",
  semfs_authorize_agent_action: "agent:authorize",
  semfs_validate_agent_output: "agent:validate",
  semfs_get_memory_status: "memory:search",
  semfs_vector_search: "memory:search",
  semfs_vector_upsert: "memory:write",
  semfs_write_safe_artifact: "artifact:safe_write",
  semfs_create_review_packet: "review:write",
  semfs_record_agent_run_event: "run:record",
  semfs_record_agent_run_result: "run:record",
  semfs_record_owner_context: "context:write",
  semfs_record_inbound_context: "context:write",
  semfs_record_capability_gap: "evolution:write",
  semfs_create_capability_proposal: "evolution:write",
  semfs_link_approval_to_artifact: "approval:write",
};

type RuntimeCapabilityKey = (typeof CAPABILITY_KEYS)[number];

interface RuntimeCapabilitySnapshot {
  schema_version: "runtime_capability_snapshot.v1";
  identity_id: string;
  conversation_id: string;
  run_id: string;
  recorded_at: string;
  source: string;
  capability_hash: string;
  capabilities: Record<RuntimeCapabilityKey, boolean>;
  runtime_tools: string[];
  notes: string | null;
}

export class RuntimeOrchestrationService {
  constructor(
    private readonly policy: PolicyService,
    private readonly writer: SafeWriter,
    private readonly vectors: VectorService,
    private readonly auth: AuthService
  ) {}

  async recordRuntimeCapabilities(
    mount: IdentityMount,
    bundle: IdentityBundle,
    input: Record<string, unknown>,
    principal?: AuthPrincipal
  ): Promise<Record<string, unknown>> {
    if (principal) this.requireTool(principal, "semfs_record_runtime_capabilities", "runtime:capability_write");
    const snapshot = this.buildRuntimeCapabilitySnapshot(bundle, input);
    const path = this.runtimeCapabilityPath(snapshot.conversation_id, snapshot.run_id);
    const latestPath = this.latestRuntimeCapabilityPath(snapshot.conversation_id);
    const previous = await this.readRuntimeCapabilitySnapshotPath(mount, latestPath);
    const capabilityChanged = previous?.capability_hash !== snapshot.capability_hash;

    await this.writer.writeSafe(mount, path, `${JSON.stringify(snapshot, null, 2)}\n`, `semfs: record runtime capabilities ${snapshot.run_id}`);
    await this.writer.writeSafe(mount, latestPath, `${JSON.stringify(snapshot, null, 2)}\n`, `semfs: record latest runtime capabilities ${snapshot.conversation_id}`);

    let vector_upsert: Record<string, unknown> | null = null;
    if (capabilityChanged) {
      vector_upsert = await this.vectors.upsert(bundle, {
        namespace: "runtime-capability-summaries",
        record_id: `runtime-capabilities-${snapshot.conversation_id}-${snapshot.capability_hash.slice(0, 12)}`,
        summary: this.runtimeCapabilitySummary(snapshot),
        content_ref: path,
        source_path: path,
        privacy_class: "internal",
        source_agent: "runtime_orchestration",
        retrieval_tags: ["runtime_capabilities", snapshot.run_id],
      });
    }

    return {
      ok: true,
      identity_id: bundle.identity_id,
      path,
      latest_path: latestPath,
      capability_changed: capabilityChanged,
      snapshot: this.publicRuntimeSnapshot(snapshot),
      vector_upsert,
    };
  }

  async runtimeCapabilityContext(mount: IdentityMount, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const conversationId = this.optionalSegment(input.conversation_id);
    const runId = this.optionalSegment(input.run_id);
    if (!conversationId || !runId) {
      return {
        snapshot_available: false,
        reason: "conversation_id and run_id are required before runtime capabilities can be used",
        capabilities: this.emptyCapabilities(),
      };
    }
    const snapshot = await this.readRuntimeCapabilitySnapshot(mount, conversationId, runId);
    if (!snapshot) {
      return {
        snapshot_available: false,
        reason: "no runtime capability snapshot recorded for this conversation/run",
        capabilities: this.emptyCapabilities(),
      };
    }
    return {
      snapshot_available: true,
      snapshot: this.publicRuntimeSnapshot(snapshot),
      capabilities: snapshot.capabilities,
    };
  }

  async prepareOrchestrationRun(
    mount: IdentityMount,
    bundle: IdentityBundle,
    input: Record<string, unknown>,
    principal: AuthPrincipal
  ): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_prepare_orchestration_run", "run:orchestrate");
    if (input.runtime_capabilities) await this.recordRuntimeCapabilities(mount, bundle, input, principal);
    const snapshot = await this.requireRuntimeSnapshot(mount, input);
    const ownerVerified = this.ownerVerified(principal, input);
    return {
      ok: true,
      identity_id: bundle.identity_id,
      conversation_id: snapshot.conversation_id,
      run_id: snapshot.run_id,
      root_agent_id: "runtime_orchestration_planner",
      runtime_capabilities: this.publicRuntimeSnapshot(snapshot),
      allowed_subagent_types: this.allowedSubagentTypes(snapshot),
      owner_turn_maturation: {
        owner_verified: ownerVerified,
        enabled: ownerVerified,
        allowed_operation_families: ownerVerified ? ["capture", "canonicalize", "review"] : ["capture", "review"],
        activation_policy: "unsupervised_live_activation_blocked_in_seed",
      },
      no_fallbacks: true,
    };
  }

  async prepareSubagentRun(
    mount: IdentityMount,
    bundle: IdentityBundle,
    input: Record<string, unknown>,
    principal: AuthPrincipal
  ): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_prepare_subagent_run", "run:orchestrate");
    const snapshot = await this.requireRuntimeSnapshot(mount, input);
    const agentId = this.requiredString(input.agent_id, "agent_id");
    const subagentType = this.requiredSubagentType(input.subagent_type);
    const inboundType = this.requiredString(input.inbound_type, "inbound_type");
    const ttlSeconds = this.requiredTtl(input.ttl_seconds);

    this.requireSubagentRuntimeCapability(snapshot, subagentType);
    const agent = this.policy.agentRecord(bundle, agentId);
    if (agent.status !== "active") throw forbidden(`Agent is not active: ${agentId}`);
    const subagentPolicy = this.requiredObject(agent.subagent_policy, `subagent_policy for ${agentId}`);
    const spawnableAs = this.requiredStringArray(subagentPolicy.spawnable_as, `subagent_policy.spawnable_as for ${agentId}`);
    const allowedInboundTypes = this.requiredStringArray(subagentPolicy.allowed_inbound_types, `subagent_policy.allowed_inbound_types for ${agentId}`);
    const allowedOperationFamilies = this.requiredStringArray(
      subagentPolicy.allowed_operation_families,
      `subagent_policy.allowed_operation_families for ${agentId}`
    );
    const allowedSemfsTools = this.requiredStringArray(subagentPolicy.allowed_semfs_tools, `subagent_policy.allowed_semfs_tools for ${agentId}`);
    const allowedVectorNamespaces = this.requiredStringArray(
      subagentPolicy.allowed_vector_namespaces,
      `subagent_policy.allowed_vector_namespaces for ${agentId}`
    );
    const policyResponseAuthority = this.requiredString(subagentPolicy.response_authority, `subagent_policy.response_authority for ${agentId}`);

    if (!spawnableAs.includes(subagentType)) throw forbidden("Agent policy does not allow this sub-agent type", { agent_id: agentId, subagent_type: subagentType });
    if (!allowedInboundTypes.includes(inboundType)) throw forbidden("Agent policy does not allow this inbound type", { agent_id: agentId, inbound_type: inboundType });

    let responseAuthority: AgentRuntimeGrant["responseAuthority"] = "parent_reviewed";
    if (input.request_direct_response === true) {
      if (!snapshot.capabilities.subagent_direct_response) throw forbidden("Runtime capability snapshot does not enable direct sub-agent response");
      if (policyResponseAuthority !== "direct_response_allowed") throw forbidden("Agent policy does not grant direct response authority");
      responseAuthority = "direct_response_allowed";
    } else if (policyResponseAuthority !== "parent_reviewed" && policyResponseAuthority !== "direct_response_allowed") {
      throw forbidden("Agent policy response authority must be explicit", { agent_id: agentId, response_authority: policyResponseAuthority });
    }

    const grantId = crypto.randomUUID();
    const grant: AgentRuntimeGrant = {
      grantId,
      runId: `${snapshot.run_id}-${grantId.slice(0, 8)}`,
      parentRunId: snapshot.run_id,
      conversationId: snapshot.conversation_id,
      agentId,
      subagentType,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      scopes: this.scopesForTools(allowedSemfsTools),
      allowedTools: allowedSemfsTools,
      allowedOperationFamilies,
      allowedVectorNamespaces,
      responseAuthority,
      ownerVerified: this.ownerVerified(principal, input),
    };
    const token = `semfs_agent_${crypto.randomUUID().replaceAll("-", "")}`;
    this.auth.registerAgentRuntimeGrant(token, grant);

    const grantPath = `conversations/${snapshot.conversation_id}/runs/${snapshot.run_id}/subagents/${grantId}.json`;
    await this.writer.writeSafe(
      mount,
      grantPath,
      `${JSON.stringify({ schema_version: "agent_runtime_grant_record.v1", ...this.publicGrant(grant) }, null, 2)}\n`,
      `semfs: record subagent grant ${grantId}`
    );

    return {
      ok: true,
      identity_id: bundle.identity_id,
      parent_run_id: snapshot.run_id,
      conversation_id: snapshot.conversation_id,
      agent_id: agentId,
      subagent_type: subagentType,
      grant: {
        token,
        token_class: "agent_runtime",
        run_id: grant.runId,
        parent_run_id: grant.parentRunId,
        conversation_id: grant.conversationId,
        expires_at: grant.expiresAt,
        scopes: grant.scopes,
        allowed_tools: grant.allowedTools,
        allowed_operation_families: grant.allowedOperationFamilies,
        allowed_vector_namespaces: grant.allowedVectorNamespaces,
        response_authority: grant.responseAuthority,
      },
      grant_record_path: grantPath,
      no_fallbacks: true,
    };
  }

  async recordAgentRunEvent(mount: IdentityMount, input: Record<string, unknown>, principal: AuthPrincipal): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_record_agent_run_event", "run:record");
    const conversationId = this.requiredSegment(input.conversation_id, "conversation_id");
    const runId = this.requiredSegment(input.run_id, "run_id");
    this.auth.requireRunScope(principal, conversationId, runId);
    const eventId = this.optionalSegment(input.event_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "agent_run_event.v1",
      event_id: eventId,
      conversation_id: conversationId,
      run_id: runId,
      agent_id: input.agent_id ?? principal.agentRuntimeGrant?.agentId ?? null,
      event_type: this.requiredString(input.event_type, "event_type"),
      recorded_at: new Date().toISOString(),
      details: this.objectOrEmpty(input.details),
    };
    const path = `conversations/${conversationId}/runs/${runId}/events/${eventId}.json`;
    await this.writer.writeSafe(mount, path, `${JSON.stringify(payload, null, 2)}\n`, `semfs: record agent run event ${eventId}`);
    return { ok: true, path, event: payload };
  }

  async recordAgentRunResult(mount: IdentityMount, input: Record<string, unknown>, principal: AuthPrincipal): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_record_agent_run_result", "run:record");
    const conversationId = this.requiredSegment(input.conversation_id, "conversation_id");
    const runId = this.requiredSegment(input.run_id, "run_id");
    this.auth.requireRunScope(principal, conversationId, runId);
    const resultId = this.optionalSegment(input.result_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "agent_run_result.v1",
      result_id: resultId,
      conversation_id: conversationId,
      run_id: runId,
      agent_id: input.agent_id ?? principal.agentRuntimeGrant?.agentId ?? null,
      status: this.requiredString(input.status, "status"),
      recorded_at: new Date().toISOString(),
      response_authority: principal.agentRuntimeGrant?.responseAuthority ?? "runtime_parent",
      output: this.objectOrEmpty(input.output),
    };
    const path = `conversations/${conversationId}/runs/${runId}/results/${resultId}.json`;
    await this.writer.writeSafe(mount, path, `${JSON.stringify(payload, null, 2)}\n`, `semfs: record agent run result ${resultId}`);
    return { ok: true, path, result: payload };
  }

  async recordOwnerContext(mount: IdentityMount, input: Record<string, unknown>, principal: AuthPrincipal): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_record_owner_context", "context:write");
    if (!this.ownerVerified(principal, input)) throw forbidden("Owner context recording requires owner-verified runtime context or an owner-runtime credential");
    const conversationId = this.requiredSegment(input.conversation_id, "conversation_id");
    this.auth.requireRunScope(principal, conversationId);
    const contextId = this.optionalSegment(input.context_id) ?? crypto.randomUUID();
    const payload = this.contextPayload("owner_context.v1", contextId, input, "captured");
    const path = `conversations/${conversationId}/artifacts/owner-context-${contextId}.json`;
    await this.writer.writeSafe(mount, path, `${JSON.stringify(payload, null, 2)}\n`, `semfs: record owner context ${contextId}`);
    return { ok: true, path, context: payload };
  }

  async recordInboundContext(mount: IdentityMount, input: Record<string, unknown>, principal: AuthPrincipal): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_record_inbound_context", "context:write");
    const conversationId = this.requiredSegment(input.conversation_id, "conversation_id");
    this.auth.requireRunScope(principal, conversationId);
    const contextId = this.optionalSegment(input.context_id) ?? crypto.randomUUID();
    const payload = this.contextPayload("inbound_context.v1", contextId, input, "captured");
    const path = `conversations/${conversationId}/artifacts/inbound-context-${contextId}.json`;
    await this.writer.writeSafe(mount, path, `${JSON.stringify(payload, null, 2)}\n`, `semfs: record inbound context ${contextId}`);
    return { ok: true, path, context: payload };
  }

  async recordCapabilityGap(
    mount: IdentityMount,
    bundle: IdentityBundle,
    input: Record<string, unknown>,
    principal: AuthPrincipal
  ): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_record_capability_gap", "evolution:write");
    const gapId = this.optionalSegment(input.gap_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "capability_gap_record.v1",
      gap_id: gapId,
      recorded_at: new Date().toISOString(),
      source_agent: input.source_agent ?? principal.agentRuntimeGrant?.agentId ?? "runtime",
      gap: this.requiredString(input.gap, "gap"),
      blocked_action: this.requiredString(input.blocked_action, "blocked_action"),
      safe_default: this.requiredString(input.safe_default, "safe_default"),
      promotion_state: "captured",
      activation_performed: false,
    };
    const path = `identity_state/capability_evolution/gaps/${gapId}.json`;
    this.auth.requireVectorNamespace(principal, "capability-gap-history");
    await this.writer.writeSafe(mount, path, `${JSON.stringify(payload, null, 2)}\n`, `semfs: record capability gap ${gapId}`);
    const vector = await this.vectors.upsert(bundle, {
      namespace: "capability-gap-history",
      record_id: gapId,
      summary: `${payload.gap} Blocked action: ${payload.blocked_action}. Safe default: ${payload.safe_default}.`,
      content_ref: path,
      source_path: path,
      privacy_class: "internal",
      source_agent: String(payload.source_agent),
      retrieval_tags: ["capability_gap"],
    });
    return { ok: true, path, gap: payload, vector_upsert: vector };
  }

  async createCapabilityProposal(
    mount: IdentityMount,
    bundle: IdentityBundle,
    input: Record<string, unknown>,
    principal: AuthPrincipal
  ): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_create_capability_proposal", "evolution:write");
    const proposalId = this.optionalSegment(input.proposal_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "capability_proposal.v1",
      proposal_id: proposalId,
      created_at: new Date().toISOString(),
      source_agent: input.source_agent ?? principal.agentRuntimeGrant?.agentId ?? "runtime",
      name: this.requiredString(input.name, "name"),
      summary: this.requiredString(input.summary, "summary"),
      status: "proposed_inactive",
      promotion_state: "draft",
      activation_performed: false,
      activation_requirements: this.stringArray(input.activation_requirements),
      owner_approval_required: true,
    };
    const path = `identity_state/capability_evolution/proposals/${proposalId}.json`;
    this.auth.requireVectorNamespace(principal, "capability-proposal-history");
    await this.writer.writeSafe(mount, path, `${JSON.stringify(payload, null, 2)}\n`, `semfs: create capability proposal ${proposalId}`);
    const vector = await this.vectors.upsert(bundle, {
      namespace: "capability-proposal-history",
      record_id: proposalId,
      summary: `${payload.name}: ${payload.summary}`,
      content_ref: path,
      source_path: path,
      privacy_class: "internal",
      source_agent: String(payload.source_agent),
      retrieval_tags: ["capability_proposal"],
    });
    return { ok: true, path, proposal: payload, vector_upsert: vector };
  }

  async linkApprovalToArtifact(mount: IdentityMount, input: Record<string, unknown>, principal: AuthPrincipal): Promise<Record<string, unknown>> {
    this.requireTool(principal, "semfs_link_approval_to_artifact", "approval:write");
    const linkId = this.optionalSegment(input.link_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "approval_artifact_link.v1",
      link_id: linkId,
      linked_at: new Date().toISOString(),
      decision_id: this.requiredString(input.decision_id, "decision_id"),
      artifact_ref: this.requiredString(input.artifact_ref, "artifact_ref"),
      approval_status: this.requiredString(input.approval_status, "approval_status"),
      activation_performed: false,
      note: input.note ?? null,
    };
    const path = `identity_state/authority/approval-links/${linkId}.json`;
    await this.writer.writeSafe(mount, path, `${JSON.stringify(payload, null, 2)}\n`, `semfs: link approval ${linkId}`);
    return { ok: true, path, approval_link: payload };
  }

  capabilityEnabled(context: Record<string, unknown>, key: RuntimeCapabilityKey): boolean {
    const capabilities = context.capabilities as Record<string, unknown> | undefined;
    return capabilities?.[key] === true;
  }

  private requireTool(principal: AuthPrincipal, toolName: string, scope: AuthScope): void {
    this.auth.requireScope(principal, scope);
    this.auth.requireTool(principal, toolName);
  }

  private buildRuntimeCapabilitySnapshot(bundle: IdentityBundle, input: Record<string, unknown>): RuntimeCapabilitySnapshot {
    const rawCapabilities = this.requiredObject(input.runtime_capabilities ?? input.capabilities, "runtime_capabilities");
    const capabilities = this.emptyCapabilities();
    for (const key of CAPABILITY_KEYS) capabilities[key] = rawCapabilities[key] === true;
    const runtimeTools = this.stringArray(input.runtime_tools ?? rawCapabilities.runtime_tools).sort();
    const conversationId = this.requiredSegment(input.conversation_id, "conversation_id");
    const runId = this.requiredSegment(input.run_id, "run_id");
    const hashBasis = { capabilities, runtime_tools: runtimeTools };
    return {
      schema_version: "runtime_capability_snapshot.v1",
      identity_id: bundle.identity_id,
      conversation_id: conversationId,
      run_id: runId,
      recorded_at: new Date().toISOString(),
      source: String(input.source ?? "runtime"),
      capability_hash: crypto.createHash("sha256").update(JSON.stringify(hashBasis)).digest("hex"),
      capabilities,
      runtime_tools: runtimeTools,
      notes: typeof input.notes === "string" ? input.notes : null,
    };
  }

  private async requireRuntimeSnapshot(mount: IdentityMount, input: Record<string, unknown>): Promise<RuntimeCapabilitySnapshot> {
    const conversationId = this.requiredSegment(input.conversation_id, "conversation_id");
    const runId = this.requiredSegment(input.run_id, "run_id");
    const snapshot = await this.readRuntimeCapabilitySnapshot(mount, conversationId, runId);
    if (!snapshot) throw forbidden("Runtime capability snapshot is required; no runtime execution capability is inferred without it", { conversation_id: conversationId, run_id: runId });
    return snapshot;
  }

  private async readRuntimeCapabilitySnapshot(mount: IdentityMount, conversationId: string, runId: string): Promise<RuntimeCapabilitySnapshot | null> {
    return this.readRuntimeCapabilitySnapshotPath(mount, this.runtimeCapabilityPath(conversationId, runId));
  }

  private async readRuntimeCapabilitySnapshotPath(mount: IdentityMount, path: string): Promise<RuntimeCapabilitySnapshot | null> {
    try {
      return JSON.parse(await mount.store.readText(path)) as RuntimeCapabilitySnapshot;
    } catch {
      return null;
    }
  }

  private runtimeCapabilityPath(conversationId: string, runId: string): string {
    return `conversations/${conversationId}/runs/${runId}/runtime-capabilities.json`;
  }

  private latestRuntimeCapabilityPath(conversationId: string): string {
    return `conversations/${conversationId}/runtime-capabilities-latest.json`;
  }

  private requireSubagentRuntimeCapability(snapshot: RuntimeCapabilitySnapshot, subagentType: SubagentType): void {
    if (!snapshot.capabilities.runtime_subagent_spawn) throw forbidden("Runtime capability snapshot does not enable sub-agent spawning");
    if (!snapshot.capabilities.scoped_agent_runtime_grant) throw forbidden("Runtime capability snapshot does not enable scoped agent runtime grants");
    if (subagentType === "parallel_subagent" && !snapshot.capabilities.runtime_subagent_parallel) {
      throw forbidden("Runtime capability snapshot does not enable parallel sub-agents");
    }
    if (subagentType === "continuation_subagent" && !snapshot.capabilities.runtime_subagent_continuation) {
      throw forbidden("Runtime capability snapshot does not enable continuation sub-agents");
    }
  }

  private allowedSubagentTypes(snapshot: RuntimeCapabilitySnapshot): SubagentType[] {
    if (!snapshot.capabilities.runtime_subagent_spawn || !snapshot.capabilities.scoped_agent_runtime_grant) return [];
    const allowed: SubagentType[] = ["inline_subagent"];
    if (snapshot.capabilities.runtime_subagent_parallel) allowed.push("parallel_subagent");
    if (snapshot.capabilities.runtime_subagent_continuation) allowed.push("continuation_subagent");
    return allowed;
  }

  private scopesForTools(tools: string[]): AuthScope[] {
    const scopes = new Set<AuthScope>();
    for (const tool of tools) {
      const scope = TOOL_SCOPES[tool];
      if (!scope) throw forbidden("Sub-agent policy references a SemFS tool with no scoped grant mapping", { tool });
      scopes.add(scope);
    }
    return [...scopes].sort();
  }

  private contextPayload(schemaVersion: string, contextId: string, input: Record<string, unknown>, promotionState: string): Record<string, unknown> {
    return {
      schema_version: schemaVersion,
      context_id: contextId,
      captured_at: new Date().toISOString(),
      source: String(input.source ?? "runtime"),
      summary: this.requiredString(input.summary, "summary"),
      details: this.objectOrEmpty(input.details),
      promotion_state: promotionState,
      activation_performed: false,
    };
  }

  private ownerVerified(principal: AuthPrincipal, input: Record<string, unknown>): boolean {
    if (principal.tokenClass === "agent_runtime") return principal.agentRuntimeGrant?.ownerVerified === true;
    return principal.tokenClass === "owner_runtime" || input.owner_verified === true;
  }

  private publicRuntimeSnapshot(snapshot: RuntimeCapabilitySnapshot): Record<string, unknown> {
    return {
      schema_version: snapshot.schema_version,
      identity_id: snapshot.identity_id,
      conversation_id: snapshot.conversation_id,
      run_id: snapshot.run_id,
      recorded_at: snapshot.recorded_at,
      source: snapshot.source,
      capability_hash: snapshot.capability_hash,
      capabilities: snapshot.capabilities,
      runtime_tools: snapshot.runtime_tools,
    };
  }

  private publicGrant(grant: AgentRuntimeGrant): Record<string, unknown> {
    return {
      grant_id: grant.grantId,
      run_id: grant.runId,
      parent_run_id: grant.parentRunId,
      conversation_id: grant.conversationId,
      agent_id: grant.agentId,
      subagent_type: grant.subagentType,
      expires_at: grant.expiresAt,
      scopes: grant.scopes,
      allowed_tools: grant.allowedTools,
      allowed_operation_families: grant.allowedOperationFamilies,
      allowed_vector_namespaces: grant.allowedVectorNamespaces,
      response_authority: grant.responseAuthority,
      owner_verified: grant.ownerVerified,
    };
  }

  private runtimeCapabilitySummary(snapshot: RuntimeCapabilitySnapshot): string {
    const enabled = Object.entries(snapshot.capabilities)
      .filter(([, value]) => value)
      .map(([key]) => key)
      .join(", ");
    return `Runtime capabilities for conversation ${snapshot.conversation_id}, run ${snapshot.run_id}: ${enabled || "none enabled"}.`;
  }

  private emptyCapabilities(): Record<RuntimeCapabilityKey, boolean> {
    return {
      runtime_subagent_spawn: false,
      runtime_subagent_parallel: false,
      runtime_subagent_continuation: false,
      scoped_agent_runtime_grant: false,
      external_lookup: false,
      subagent_direct_response: false,
    };
  }

  private requiredObject(value: unknown, name: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest(`${name} is required`);
    return value as Record<string, unknown>;
  }

  private objectOrEmpty(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private requiredString(value: unknown, name: string): string {
    const text = String(value ?? "").trim();
    if (!text) throw badRequest(`${name} is required`);
    return text;
  }

  private requiredStringArray(value: unknown, name: string): string[] {
    const values = this.stringArray(value);
    if (!values.length) throw badRequest(`${name} is required`);
    return values;
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map(String).map((entry) => entry.trim()).filter(Boolean);
  }

  private requiredSubagentType(value: unknown): SubagentType {
    const type = this.requiredString(value, "subagent_type") as SubagentType;
    if (!SUBAGENT_TYPES.has(type)) throw badRequest("subagent_type must be inline_subagent, parallel_subagent, or continuation_subagent");
    return type;
  }

  private requiredTtl(value: unknown): number {
    const ttl = Number(value);
    if (!Number.isFinite(ttl) || ttl < 1 || ttl > 3600) throw badRequest("ttl_seconds must be between 1 and 3600");
    return Math.floor(ttl);
  }

  private requiredSegment(value: unknown, name: string): string {
    const segment = this.optionalSegment(value);
    if (!segment) throw badRequest(`${name} is required`);
    return segment;
  }

  private optionalSegment(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const segment = raw.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120);
    if (!segment || segment === "." || segment === "..") return null;
    return segment;
  }
}
