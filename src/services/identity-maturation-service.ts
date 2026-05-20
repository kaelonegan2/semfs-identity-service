import crypto from "node:crypto";
import { AuthPrincipal, AuthScope, IdentityMount } from "../types/core.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { IdentityBundle } from "./identity-loader.js";
import { AuthService } from "./auth-service.js";
import { VectorService } from "./vector-service.js";

type Json = Record<string, unknown>;

const SECRETISH_KEYS = ["secret", "token", "password", "api_key", "apikey", "private_key", "credential"];

export class IdentityMaturationService {
  constructor(
    private readonly auth: AuthService,
    private readonly vectors: VectorService
  ) {}

  async recordKnowledgeDraft(mount: IdentityMount, bundle: IdentityBundle, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_record_knowledge_draft", "context:write");
    const draftId = this.segment(input.draft_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "knowledge_draft.v1",
      draft_id: draftId,
      title: this.required(input.title, "title"),
      summary: this.required(input.summary, "summary"),
      items: this.array(input.items),
      source_basis: this.array(input.source_basis),
      review_questions: this.array(input.review_questions),
      safe_default: String(input.safe_default ?? "Treat as draft-only until reviewed."),
      promotion_state: "draft",
      created_at: new Date().toISOString(),
      source_agent: input.source_agent ?? principal.agentRuntimeGrant?.agentId ?? "runtime",
    };
    const path = `identity_state/knowledge/drafts/${draftId}.json`;
    await this.writeJson(mount, path, payload, `semfs: record knowledge draft ${draftId}`);
    const vector = await this.upsertOptional(principal, bundle, "knowledge-draft-feedback", draftId, `${payload.title}: ${payload.summary}`, path, String(payload.source_agent), ["knowledge_draft"]);
    return { ok: true, path, draft: payload, vector_upsert: vector };
  }

  async promoteKnowledgeDraft(mount: IdentityMount, bundle: IdentityBundle, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_promote_knowledge_draft", "approval:write");
    const draftId = this.requiredSegment(input.draft_id, "draft_id");
    const approvalRef = this.required(input.approval_ref, "approval_ref");
    const draftPath = `identity_state/knowledge/drafts/${draftId}.json`;
    const draft = await this.readJsonOrThrow(mount, draftPath);
    const knowledgeId = this.segment(input.knowledge_id) ?? draftId;
    const payload = {
      schema_version: "approved_knowledge_item.v1",
      knowledge_id: knowledgeId,
      promoted_from: draftPath,
      approval_ref: approvalRef,
      approved_by_role: String(input.approved_by_role ?? "owner_or_delegated_reviewer"),
      promoted_at: new Date().toISOString(),
      title: draft.title,
      summary: draft.summary,
      items: this.array(draft.items),
      source_basis: this.array(draft.source_basis),
      promotion_state: "canonical",
    };
    const path = `identity_state/knowledge/approved/${knowledgeId}.json`;
    await this.writeJson(mount, path, payload, `semfs: promote knowledge draft ${draftId}`);
    const vector = await this.upsertOptional(principal, bundle, "knowledge-draft-feedback", knowledgeId, `${payload.title}: ${payload.summary}`, path, String(input.source_agent ?? "runtime"), ["approved_knowledge"]);
    return { ok: true, path, knowledge: payload, vector_upsert: vector };
  }

  async applyVoiceProfileUpdate(mount: IdentityMount, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_apply_voice_profile_update", "identity:profile_write");
    const profile = await this.readJsonOrDefault(mount, "identity_state/profile/current.json", {});
    const update = {
      voice_summary: this.required(input.voice_summary, "voice_summary"),
      tone: this.array(input.tone),
      style_guidance: this.array(input.style_guidance),
      avoid: this.array(input.avoid),
      approval_ref: input.approval_ref ?? null,
      updated_at: new Date().toISOString(),
    };
    const nextProfile = { ...profile, ...update };
    await this.writeJson(mount, "identity_state/profile/current.json", nextProfile, "semfs: apply voice profile update");
    const markdown = `# Brand Voice\n\nRole: \`authoritative\` owner-approved voice guidance.\n\n## Summary\n\n${update.voice_summary}\n\n## Tone\n\n${this.bullets(update.tone)}\n\n## Style Guidance\n\n${this.bullets(update.style_guidance)}\n\n## Avoid\n\n${this.bullets(update.avoid)}\n`;
    await mount.store.writeText("identity/context/brand-voice.md", markdown, "semfs: update brand voice");
    return { ok: true, path: "identity_state/profile/current.json", voice_path: "identity/context/brand-voice.md", profile: nextProfile };
  }

  async applyDomainContext(mount: IdentityMount, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_apply_domain_context", "identity:profile_write");
    const profile = await this.readJsonOrDefault(mount, "identity_state/profile/current.json", {});
    const update = {
      business_or_function_domain: this.required(input.business_or_function_domain, "business_or_function_domain"),
      audience_or_market: String(input.audience_or_market ?? profile.audience_or_market ?? "unknown"),
      operating_area: input.operating_area ?? null,
      domain_summary: String(input.domain_summary ?? input.business_or_function_domain),
      approval_ref: input.approval_ref ?? null,
      updated_at: new Date().toISOString(),
    };
    const nextProfile = { ...profile, ...update };
    await this.writeJson(mount, "identity_state/profile/current.json", nextProfile, "semfs: apply domain context");
    const markdown = `# Customer Model\n\nRole: \`authoritative\` owner-approved domain and audience context.\n\n## Domain\n\n${update.business_or_function_domain}\n\n## Audience Or Market\n\n${update.audience_or_market}\n\n## Operating Area\n\n${String(update.operating_area ?? "Not specified")}\n\n## Summary\n\n${update.domain_summary}\n`;
    await mount.store.writeText("identity/context/customer-model.md", markdown, "semfs: update domain context");
    return { ok: true, path: "identity_state/profile/current.json", customer_model_path: "identity/context/customer-model.md", profile: nextProfile };
  }

  async applyOfferCatalogUpdate(mount: IdentityMount, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_apply_offer_catalog_update", "identity:profile_write");
    const offers = this.array(input.offers);
    if (!offers.length) throw badRequest("offers must include at least one item");
    const catalogId = this.segment(input.catalog_id) ?? "current";
    const payload = {
      schema_version: "offer_catalog.v1",
      catalog_id: catalogId,
      offers,
      pricing_posture: String(input.pricing_posture ?? "no final pricing or commitments without approval"),
      authority_notes: String(input.authority_notes ?? "Drafting and qualification only unless separately approved."),
      approval_ref: input.approval_ref ?? null,
      promotion_state: "canonical",
      updated_at: new Date().toISOString(),
    };
    const jsonPath = `identity_state/knowledge/approved/offer-catalog-${catalogId}.json`;
    await this.writeJson(mount, jsonPath, payload, `semfs: apply offer catalog ${catalogId}`);
    const markdown = `# Offers\n\nRole: \`authoritative\` owner-approved offer catalog.\n\n## Pricing Posture\n\n${payload.pricing_posture}\n\n## Authority Notes\n\n${payload.authority_notes}\n\n## Offers\n\n${this.bullets(offers)}\n`;
    await mount.store.writeText("identity/context/offers.md", markdown, "semfs: update offers");
    return { ok: true, path: jsonPath, offers_path: "identity/context/offers.md", catalog: payload };
  }

  async recordResearchSource(mount: IdentityMount, bundle: IdentityBundle, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_record_research_source", "context:write");
    const sourceId = this.segment(input.source_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "research_source.v1",
      source_id: sourceId,
      title: this.required(input.title, "title"),
      url: input.url ?? null,
      summary: this.required(input.summary, "summary"),
      confidence: String(input.confidence ?? "unreviewed"),
      relevance: String(input.relevance ?? "unknown"),
      review_status: String(input.review_status ?? "needs_review"),
      recorded_at: new Date().toISOString(),
      source_agent: input.source_agent ?? principal.agentRuntimeGrant?.agentId ?? "runtime",
    };
    const path = `identity_state/research/sources/${sourceId}.json`;
    await this.writeJson(mount, path, payload, `semfs: record research source ${sourceId}`);
    const vector = await this.upsertOptional(principal, bundle, "research-summary-drafts", sourceId, `${payload.title}: ${payload.summary}`, path, String(payload.source_agent), ["research_source"]);
    return { ok: true, path, source: payload, vector_upsert: vector };
  }

  async resolveReviewPacket(mount: IdentityMount, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_resolve_review_packet", "approval:write");
    const resolutionId = this.segment(input.resolution_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "review_resolution.v1",
      resolution_id: resolutionId,
      review_packet_ref: this.required(input.review_packet_ref, "review_packet_ref"),
      decision: this.required(input.decision, "decision"),
      reviewer: String(input.reviewer ?? "human"),
      summary: String(input.summary ?? ""),
      allowed_next_operations: this.array(input.allowed_next_operations),
      blocked_operations: this.array(input.blocked_operations),
      resolved_at: new Date().toISOString(),
      activation_performed: false,
    };
    const path = `identity_state/authority/review-resolutions/${resolutionId}.json`;
    await this.writeJson(mount, path, payload, `semfs: resolve review packet ${resolutionId}`);
    return { ok: true, path, resolution: payload };
  }

  async getBudgetPosture(mount: IdentityMount, input: Json): Promise<Json> {
    const budgets = await this.readJsonOrDefault(mount, "identity_state/governance/usage-budgets.json", {});
    const thresholds = this.object(budgets.conversation_thresholds);
    const usage = this.object(input.usage);
    const warnings: string[] = [];
    const approvals: string[] = [];
    this.compare(usage, thresholds, "model_calls", "model_calls_warn", warnings);
    this.compare(usage, thresholds, "tool_calls", "tool_calls_warn", warnings);
    this.compare(usage, thresholds, "vector_retrievals", "vector_retrievals_warn", warnings);
    this.compare(usage, thresholds, "estimated_cost_usd", "estimated_cost_usd_warn", warnings);
    this.compare(usage, thresholds, "model_calls", "model_calls_require_approval", approvals);
    this.compare(usage, thresholds, "estimated_cost_usd", "estimated_cost_usd_require_approval", approvals);
    const posture = approvals.length ? "requires_approval" : warnings.length ? "warn" : "normal";
    return {
      ok: true,
      schema_version: "budget_posture.v1",
      posture,
      usage,
      warnings,
      approvals_required: approvals,
      thresholds,
      safe_default: posture === "normal" ? "continue" : posture === "warn" ? String(thresholds.on_warn ?? "warn") : String(thresholds.on_require_approval ?? "require_approval"),
    };
  }

  async createCredentialBindingRequest(mount: IdentityMount, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_create_credential_binding_request", "review:write");
    this.assertNoSecrets(input);
    const requestId = this.segment(input.request_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "credential_binding_request.v1",
      request_id: requestId,
      capability: this.required(input.capability, "capability"),
      credential_alias: this.required(input.credential_alias, "credential_alias"),
      requested_scopes: this.array(input.requested_scopes),
      risk: String(input.risk ?? "owner_review_required"),
      approval_required: true,
      status: "requested",
      secret_storage: "not_in_identity_repo",
      requested_at: new Date().toISOString(),
      source_agent: input.source_agent ?? principal.agentRuntimeGrant?.agentId ?? "runtime",
    };
    const path = `identity_state/security/credential-requests/${requestId}.json`;
    await this.writeJson(mount, path, payload, `semfs: create credential binding request ${requestId}`);
    return { ok: true, path, request: payload };
  }

  async activateAgent(mount: IdentityMount, bundle: IdentityBundle, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_activate_agent", "activation:write");
    const agentId = this.requiredSegment(input.agent_id, "agent_id");
    const approvalRef = this.required(input.approval_ref, "approval_ref");
    const agentsRegistry = structuredClone(bundle.agents_registry) as Json;
    const agents = this.arrayOfObjects(agentsRegistry.agents);
    const existing = agents.find((agent) => agent.id === agentId);
    const nextAgent = existing ?? {
      id: agentId,
      class: String(input.class ?? "identity_evolved_agent"),
      status: "active",
      prompt_ref: this.required(input.prompt_ref, "prompt_ref"),
      tools: this.array(input.tools),
      output_contract: this.required(input.output_contract, "output_contract"),
      facet_target: String(input.facet_target ?? input.output_contract),
      authority_limits: this.array(input.authority_limits),
    };
    nextAgent.status = "active";
    if (input.prompt_ref) nextAgent.prompt_ref = input.prompt_ref;
    if (input.output_contract) nextAgent.output_contract = input.output_contract;
    if (input.facet_target) nextAgent.facet_target = input.facet_target;
    if (input.tools) nextAgent.tools = this.array(input.tools);
    await this.assertAgentDependencies(mount, bundle, nextAgent);
    if (!existing) agents.push(nextAgent);
    agentsRegistry.agents = agents;
    agentsRegistry.inactive_future_agents = this.array(agentsRegistry.inactive_future_agents).filter((id) => id !== agentId);
    await this.writeJson(mount, "identity_state/registries/agents.json", agentsRegistry, `semfs: activate agent ${agentId}`);
    const activation = await this.recordActivation(mount, input, approvalRef, ["identity_state/registries/agents.json"], "activated");
    return { ok: true, agent: nextAgent, registry_path: "identity_state/registries/agents.json", activation };
  }

  async activateRoute(mount: IdentityMount, bundle: IdentityBundle, input: Json, principal: AuthPrincipal): Promise<Json> {
    this.requireTool(principal, "semfs_activate_route", "activation:write");
    const route = this.requiredSegment(input.route, "route");
    const agentId = this.requiredSegment(input.agent_id, "agent_id");
    const approvalRef = this.required(input.approval_ref, "approval_ref");
    const agent = this.arrayOfObjects(bundle.agents_registry.agents).find((candidate) => candidate.id === agentId);
    if (!agent || agent.status !== "active") throw badRequest("route activation requires an active agent", { agent_id: agentId });
    const dispatch = structuredClone(bundle.dispatch_map) as Json;
    const activeMode = String(dispatch.active_lifecycle_mode ?? bundle.lifecycle.current_mode ?? "seed_runtime_available");
    const lifecycleModes = this.object(dispatch.lifecycle_modes);
    const mode = this.object(lifecycleModes[activeMode]);
    const modeRoutes = this.object(mode.routes);
    const routeRecord = {
      agent_id: agentId,
      registry: "identity_state/registries/agents.json",
      prompt: String(agent.prompt_ref),
      output_contract: String(input.output_contract ?? agent.output_contract),
      facet_target: String(input.facet_target ?? agent.facet_target ?? agent.output_contract),
      trust_required: String(input.trust_required ?? "verified_owner_or_internal_agent"),
      activation_ref: approvalRef,
    };
    modeRoutes[route] = routeRecord;
    mode.routes = modeRoutes;
    mode.inactive_proposed_future_routes = this.array(mode.inactive_proposed_future_routes).filter((id) => id !== route);
    lifecycleModes[activeMode] = mode;
    dispatch.lifecycle_modes = lifecycleModes;
    dispatch.routes = { ...this.object(dispatch.routes), [route]: routeRecord };
    await this.writeJson(mount, "identity_state/orchestration/dispatch-map.json", dispatch, `semfs: activate route ${route}`);
    const activation = await this.recordActivation(mount, input, approvalRef, ["identity_state/orchestration/dispatch-map.json"], "activated");
    return { ok: true, route, route_info: routeRecord, dispatch_path: "identity_state/orchestration/dispatch-map.json", activation };
  }

  private requireTool(principal: AuthPrincipal, toolName: string, scope: AuthScope): void {
    this.auth.requireScope(principal, scope);
    this.auth.requireTool(principal, toolName);
  }

  private async assertAgentDependencies(mount: IdentityMount, bundle: IdentityBundle, agent: Json): Promise<void> {
    const promptRef = this.required(agent.prompt_ref, "prompt_ref");
    if (!(await mount.store.exists(promptRef))) throw badRequest("agent prompt_ref does not exist", { prompt_ref: promptRef });
    const outputContract = this.required(agent.output_contract, "output_contract");
    const contracts = this.object(bundle.output_contracts.contracts);
    if (!contracts[outputContract]) throw badRequest("agent output_contract is not registered", { output_contract: outputContract });
    const facetTarget = String(agent.facet_target ?? outputContract);
    const facets = this.object(bundle.facet_policy.facets);
    if (facetTarget !== "none_runtime_decision_only" && !facets[facetTarget]) throw badRequest("agent facet_target is not registered", { facet_target: facetTarget });
  }

  private async recordActivation(mount: IdentityMount, input: Json, approvalRef: string, activatedFiles: string[], status: string): Promise<Json> {
    const activationId = this.segment(input.activation_id) ?? crypto.randomUUID();
    const payload = {
      schema_version: "activation_record.v1",
      activation_id: activationId,
      proposal_id: String(input.proposal_id ?? "not_provided"),
      approval_ref: approvalRef,
      approved_by_role: String(input.approved_by_role ?? "owner_or_delegated_reviewer"),
      activated_at: new Date().toISOString(),
      activated_files: activatedFiles,
      runtime_availability: String(input.runtime_availability ?? "runtime_support_asserted_by_caller"),
      status,
      eval_refs: this.array(input.eval_refs),
    };
    const path = `identity_state/capability_evolution/activations/${activationId}.json`;
    await this.writeJson(mount, path, payload, `semfs: record activation ${activationId}`);
    return { path, record: payload };
  }

  private async writeJson(mount: IdentityMount, path: string, value: unknown, message: string): Promise<void> {
    await mount.store.writeText(path, `${JSON.stringify(value, null, 2)}\n`, message);
  }

  private async readJsonOrThrow(mount: IdentityMount, path: string): Promise<Json> {
    try {
      return JSON.parse(await mount.store.readText(path)) as Json;
    } catch {
      throw notFound(`Required JSON file is missing or invalid: ${path}`);
    }
  }

  private async readJsonOrDefault(mount: IdentityMount, path: string, fallback: Json): Promise<Json> {
    try {
      return JSON.parse(await mount.store.readText(path)) as Json;
    } catch {
      return fallback;
    }
  }

  private async upsertOptional(principal: AuthPrincipal, bundle: IdentityBundle, namespace: string, recordId: string, summary: string, path: string, sourceAgent: string, tags: string[]) {
    this.auth.requireVectorNamespace(principal, namespace);
    return this.vectors.upsert(bundle, {
      namespace,
      record_id: recordId,
      summary,
      content_ref: path,
      source_path: path,
      privacy_class: "internal",
      source_agent: sourceAgent,
      retrieval_tags: tags,
    });
  }

  private compare(usage: Json, thresholds: Json, usageKey: string, thresholdKey: string, target: string[]): void {
    const value = Number(usage[usageKey] ?? 0);
    const threshold = Number(thresholds[thresholdKey]);
    if (Number.isFinite(threshold) && value >= threshold) target.push(`${usageKey} >= ${thresholdKey}`);
  }

  private assertNoSecrets(input: unknown): void {
    const text = JSON.stringify(input).toLowerCase();
    if (SECRETISH_KEYS.some((key) => text.includes(`"${key}"`))) {
      throw forbidden("Credential binding requests must not include secrets, tokens, passwords, or private keys");
    }
  }

  private required(value: unknown, name: string): string {
    if (typeof value !== "string" || !value.trim()) throw badRequest(`${name} is required`);
    return value.trim();
  }

  private requiredSegment(value: unknown, name: string): string {
    const segment = this.segment(value);
    if (!segment) throw badRequest(`${name} is required`);
    return segment;
  }

  private segment(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const normalized = value.trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) throw badRequest("Identifier may contain only letters, numbers, dots, underscores, and dashes", { value });
    return normalized;
  }

  private array(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  private arrayOfObjects(value: unknown): Json[] {
    return this.array(value).filter((item): item is Json => Boolean(item) && typeof item === "object" && !Array.isArray(item)) as Json[];
  }

  private object(value: unknown): Json {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
  }

  private bullets(items: unknown[]): string {
    return items.length ? items.map((item) => `- ${String(item)}`).join("\n") : "- Not specified";
  }
}
