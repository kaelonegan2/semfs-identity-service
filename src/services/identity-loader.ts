import { IdentityMount } from "../types/core.js";
import { readJson, readOptionalText } from "./json.js";

const REQUIRED_JSON_FILES = [
  "identity_state/lifecycle/current.json",
  "identity_state/lifecycle/mode-permissions.json",
  "identity_state/orchestration/dispatch-map.json",
  "identity_state/registries/agents.json",
  "identity_state/registries/tools.json",
  "identity_state/registries/output-contracts.json",
  "identity_state/registries/facet-policy.json",
];

export interface IdentityBundle {
  identity_id: string;
  store_label: string;
  store_kind: string;
  lifecycle: Record<string, unknown>;
  mode_permissions: Record<string, unknown>;
  status: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  readiness: Record<string, unknown> | null;
  dispatch_map: Record<string, unknown>;
  agents_registry: Record<string, unknown>;
  tools_registry: Record<string, unknown>;
  tool_aliases: Record<string, unknown> | null;
  output_contracts: Record<string, unknown>;
  facet_policy: Record<string, unknown>;
  vector_namespaces: Record<string, unknown> | null;
  specialists: Record<string, unknown> | null;
  roles_markdown: string | null;
  skills_markdown: string | null;
  authority_markdown: string | null;
  orchestration_policy_markdown: string | null;
  prompt_map_markdown: string | null;
}

export class IdentityLoader {
  async status(mount: IdentityMount): Promise<Record<string, unknown>> {
    const existing_required_json: string[] = [];
    const missing_required_json: string[] = [];
    const invalid_required_json: Array<{ path: string; error: string }> = [];

    for (const relPath of REQUIRED_JSON_FILES) {
      if (!(await mount.store.exists(relPath))) {
        missing_required_json.push(relPath);
        continue;
      }
      existing_required_json.push(relPath);
      try {
        JSON.parse(await mount.store.readText(relPath));
      } catch (error) {
        invalid_required_json.push({ path: relPath, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const loadable = missing_required_json.length === 0 && invalid_required_json.length === 0;
    const state = loadable ? "ready" : existing_required_json.length === 0 ? "uninitialized" : "incomplete";

    return {
      identity_id: mount.identityId,
      store: mount.store.label,
      state,
      loadable,
      manifest_available: loadable,
      existing_required_json,
      missing_required_json,
      invalid_required_json,
      recommended_next:
        state === "ready"
          ? {
              tool: "semfs_get_manifest",
              reason: "The identity has the required canonical runtime files.",
            }
          : state === "uninitialized"
            ? {
                tool: "semfs_initialize_identity",
                reason: "The identity has no required canonical runtime files yet.",
                args: { identity_id: mount.identityId, overwrite_mode: "refuse" },
              }
            : {
                tool: "owner_or_admin_review",
                reason: "The identity has some canonical runtime files but is missing or has invalid required files. Avoid repeated manifest calls until the repo is initialized or repaired.",
              },
    };
  }

  async load(mount: IdentityMount): Promise<IdentityBundle> {
    const store = mount.store;
    const lifecycle = await readJson<Record<string, unknown>>(store, "identity_state/lifecycle/current.json");
    const identityId = String(lifecycle.identity_id ?? mount.identityId);

    return {
      identity_id: identityId,
      store_label: store.label,
      store_kind: store.kind,
      lifecycle,
      mode_permissions: await readJson(store, "identity_state/lifecycle/mode-permissions.json"),
      status: await this.optionalJson(store, "identity_state/status/current.json"),
      profile: await this.optionalJson(store, "identity_state/profile/current.json"),
      readiness: await this.optionalJson(store, "identity_state/lifecycle/readiness-score.json"),
      dispatch_map: await readJson(store, "identity_state/orchestration/dispatch-map.json"),
      agents_registry: await readJson(store, "identity_state/registries/agents.json"),
      tools_registry: await readJson(store, "identity_state/registries/tools.json"),
      tool_aliases: await this.optionalJson(store, "identity_state/registries/tool-aliases.json"),
      output_contracts: await readJson(store, "identity_state/registries/output-contracts.json"),
      facet_policy: await readJson(store, "identity_state/registries/facet-policy.json"),
      vector_namespaces: await this.optionalJson(store, "identity_state/memory/vector-namespaces.json"),
      specialists: await this.optionalJson(store, "identity_state/registries/specialists.json"),
      roles_markdown: await readOptionalText(store, "identity_state/authority/roles.md"),
      skills_markdown: await readOptionalText(store, "identity_state/skills/known-skills.md"),
      authority_markdown: await readOptionalText(store, "identity_state/authority/escalation-matrix.md"),
      orchestration_policy_markdown: await readOptionalText(store, "identity_state/orchestration/policies.md"),
      prompt_map_markdown: await readOptionalText(store, "identity_state/prompts/MAP.md"),
    };
  }

  manifest(bundle: IdentityBundle): Record<string, unknown> {
    const dispatch = bundle.dispatch_map;
    const activeMode = String(dispatch.active_lifecycle_mode ?? bundle.lifecycle.current_mode ?? "unknown");
    const lifecycleModes = dispatch.lifecycle_modes as
      | Record<string, { routes?: Record<string, unknown>; inactive_proposed_future_routes?: string[] }>
      | undefined;
    const routes = lifecycleModes?.[activeMode]?.routes ?? (dispatch.routes as Record<string, unknown> | undefined) ?? {};

    return {
      identity_id: bundle.identity_id,
      store: bundle.store_label,
      lifecycle: bundle.lifecycle,
      status: bundle.status,
      profile: bundle.profile,
      readiness: bundle.readiness,
      canonical_dispatch_map: "identity_state/orchestration/dispatch-map.json",
      active_lifecycle_mode: activeMode,
      active_routes: Object.keys(routes),
      inactive_future_routes: lifecycleModes?.[activeMode]?.inactive_proposed_future_routes ?? [],
      agents: bundle.agents_registry,
      tools: bundle.tools_registry,
      tool_aliases: bundle.tool_aliases,
      output_contracts: bundle.output_contracts,
      facet_policy: bundle.facet_policy,
      vector_namespaces: bundle.vector_namespaces,
      specialists: bundle.specialists,
    };
  }

  identityMap(bundle: IdentityBundle): Record<string, unknown> {
    const authGates = {
      read: "identity:read",
      capture: "context:write | artifact:safe_write | memory:write | evolution:write",
      review: "review:write | approval:write",
      activate: "not available in SemFS V1",
    };

    return {
      identity_id: bundle.identity_id,
      schema_version: "identity_map_coverage.v1",
      role: "runtime identity-map traversal and operation coverage",
      read_first: [
        "identity_state/lifecycle/current.json",
        "identity_state/status/current.json",
        "identity_state/profile/current.json",
        "identity_state/orchestration/dispatch-map.json",
        "identity_state/registries/agents.json",
        "identity_state/registries/tools.json",
        "identity_state/registries/output-contracts.json",
        "identity_state/registries/facet-policy.json",
      ],
      operation_families: {
        inspect: {
          available: ["semfs_get_identity_status", "semfs_get_manifest", "semfs_get_identity_map", "semfs_get_agent", "semfs_get_memory_status"],
          auth_gate: authGates.read,
        },
        prepare: {
          available: ["semfs_prepare_inbound", "semfs_prepare_agent_action", "semfs_prepare_orchestration_run", "semfs_prepare_subagent_run"],
          auth_gate: "inbound:prepare | agent:prepare | run:orchestrate",
        },
        capture: {
          available: [
            "semfs_record_owner_context",
            "semfs_record_inbound_context",
            "semfs_record_knowledge_draft",
            "semfs_record_research_source",
            "semfs_record_runtime_capabilities",
            "semfs_record_agent_run_event",
            "semfs_record_agent_run_result",
            "semfs_write_safe_artifact",
            "semfs_vector_upsert",
            "semfs_record_capability_gap",
          ],
          auth_gate: authGates.capture,
        },
        review: {
          available: [
            "semfs_create_review_packet",
            "semfs_capture_approval",
            "semfs_link_approval_to_artifact",
            "semfs_resolve_review_packet",
            "semfs_create_capability_proposal",
            "semfs_promote_knowledge_draft",
            "semfs_create_credential_binding_request",
          ],
          auth_gate: authGates.review,
        },
        canonicalize: {
          available: ["semfs_apply_owner_identity_seed", "semfs_apply_voice_profile_update", "semfs_apply_domain_context", "semfs_apply_offer_catalog_update"],
          missing_high_value: [
            "semfs_apply_authority_policy_update",
          ],
          auth_gate: "identity:profile_write | identity:seed_update",
        },
        activate: {
          available: ["semfs_activate_agent", "semfs_activate_route"],
          missing_high_value: [
            "semfs_activate_capability",
            "semfs_activate_tool",
            "semfs_activate_specialist",
            "semfs_activate_memory_namespace",
            "semfs_change_lifecycle_mode",
          ],
          auth_gate: authGates.activate,
        },
      },
      areas: [
        {
          key: "identity_context",
          map_ref: "identity/MAP.md",
          primary_refs: ["identity/context/identity-brief.md", "identity/context/offers.md", "identity/rules/authority.md", "identity/rules/privacy.md", "identity/context/brand-voice.md"],
          runtime_use: "semantic identity book: purpose, offers, voice, privacy, authority, and future playbooks",
          current_operations: ["semfs_get_manifest", "semfs_apply_owner_identity_seed", "semfs_apply_voice_profile_update", "semfs_apply_domain_context", "semfs_apply_offer_catalog_update", "semfs_record_owner_context", "semfs_write_safe_artifact", "semfs_vector_upsert"],
          needed_operations: [],
          mutation_posture: "capture and owner-approved profile, voice, domain, and offer canonicalization are available",
        },
        {
          key: "lifecycle",
          map_ref: "identity_state/lifecycle/MAP.md",
          primary_refs: ["identity_state/lifecycle/current.json", "identity_state/lifecycle/mode-permissions.json", "identity_state/lifecycle/readiness-score.json", "identity_state/lifecycle/evolution-profiles.json"],
          runtime_use: "maturity mode, permissions, readiness, and owner-governed evolution profiles",
          current_operations: ["semfs_get_identity_status", "semfs_get_manifest", "semfs_prepare_inbound"],
          needed_operations: ["semfs_change_lifecycle_mode"],
          mutation_posture: "read-only in V1; lifecycle writes are blocked",
        },
        {
          key: "orchestration",
          map_ref: "identity_state/orchestration/MAP.md",
          primary_refs: ["identity_state/orchestration/dispatch-map.json", "identity_state/orchestration/stages.json", "identity_state/orchestration/graph.json"],
          runtime_use: "route selection, stage semantics, active dispatch, and inactive future routes",
          current_operations: ["semfs_prepare_inbound", "semfs_prepare_orchestration_run", "semfs_prepare_agent_action", "semfs_prepare_subagent_run", "semfs_activate_route"],
          needed_operations: ["semfs_retire_route"],
          mutation_posture: "active seed dispatch plus owner-approved route activation are available",
        },
        {
          key: "agents_and_registries",
          map_ref: "identity_state/registries/MAP.md",
          primary_refs: ["identity_state/registries/agents.json", "identity_state/agents/lifecycle.md", "identity_state/agents/candidate-agents.md"],
          runtime_use: "registered internal agents, candidate agents, tool permissions, output contracts, and facet policy",
          current_operations: ["semfs_get_agent", "semfs_prepare_agent_action", "semfs_authorize_agent_action", "semfs_validate_agent_output", "semfs_prepare_subagent_run", "semfs_activate_agent"],
          needed_operations: ["semfs_create_agent_proposal", "semfs_update_agent_prompt", "semfs_activate_tool", "semfs_activate_specialist"],
          mutation_posture: "read/prepare/validate plus owner-approved agent activation are available; arbitrary registry mutation remains blocked",
        },
        {
          key: "knowledge",
          map_ref: "identity_state/knowledge/MAP.md",
          primary_refs: ["identity_state/knowledge/review-queue.md", "identity_state/knowledge/common-questions.md", "identity_state/knowledge/common-answers.md", "identity_state/knowledge/scoring-model.md"],
          runtime_use: "draft, review, score, approve, and improve external-facing knowledge",
          current_operations: ["semfs_record_knowledge_draft", "semfs_promote_knowledge_draft", "semfs_write_safe_artifact", "semfs_vector_upsert", "semfs_create_review_packet", "semfs_link_approval_to_artifact"],
          needed_operations: ["semfs_supersede_knowledge_item"],
          mutation_posture: "draft capture and owner-approved knowledge promotion are available",
        },
        {
          key: "research",
          map_ref: "identity_state/research/MAP.md",
          primary_refs: ["identity_state/research/business-research-plan.md", "identity_state/research/market-research-plan.md", "identity_state/research/competitor-research-plan.md", "identity_state/research/research-output-contracts.json"],
          runtime_use: "research plans, source summaries, and public/private separation before knowledge promotion",
          current_operations: ["semfs_record_research_source", "semfs_write_safe_artifact", "semfs_vector_upsert", "semfs_record_capability_gap"],
          needed_operations: ["semfs_record_research_summary", "semfs_mark_research_reviewed"],
          mutation_posture: "plans and source-level research provenance can be captured",
        },
        {
          key: "memory",
          map_ref: "identity_state/memory/MAP.md",
          primary_refs: ["identity_state/memory/vector-namespaces.json", "identity_state/memory/retrieval-policy.md", "identity_state/memory/upsert-policy.md", "identity_state/memory/namespace-maturation-map.json"],
          runtime_use: "policy-governed vector namespaces, retrieval, upsert, and namespace maturation",
          current_operations: ["semfs_get_memory_status", "semfs_vector_search", "semfs_vector_upsert"],
          needed_operations: ["semfs_activate_memory_namespace", "semfs_promote_memory_summary", "semfs_retire_memory_summary"],
          mutation_posture: "summary search/upsert exists; namespace activation and summary promotion are missing",
        },
        {
          key: "authority",
          map_ref: "identity_state/authority/MAP.md",
          primary_refs: ["identity_state/authority/roles.md", "identity_state/authority/escalation-matrix.json", "identity_state/authority/human-review-packet.schema.json", "identity_state/authority/approval-results.schema.json"],
          runtime_use: "review packets, approvals, escalation, and opaque trust assertions",
          current_operations: ["semfs_create_review_packet", "semfs_capture_approval", "semfs_link_approval_to_artifact", "semfs_resolve_review_packet", "semfs_authorize_agent_action"],
          needed_operations: ["semfs_apply_reviewed_context", "semfs_apply_authority_policy_update"],
          mutation_posture: "review capture and resolution are available; applying reviewed decisions to canonical policy is missing",
        },
        {
          key: "governance",
          map_ref: "identity_state/governance/MAP.md",
          primary_refs: ["identity_state/governance/usage-policy.md", "identity_state/governance/usage-budgets.json", "identity_state/governance/model-selection.md", "identity_state/governance/model-classes.json"],
          runtime_use: "usage policy, model class guidance, budgets, usage events, and rollups",
          current_operations: ["semfs_record_agent_run_event", "semfs_record_agent_run_result", "semfs_get_budget_posture", "semfs_vector_upsert"],
          needed_operations: ["semfs_record_usage_event", "semfs_record_usage_rollup"],
          mutation_posture: "run telemetry and budget posture checks exist; usage rollups are not first-class yet",
        },
        {
          key: "security_and_credentials",
          map_ref: "identity_state/security/MAP.md",
          primary_refs: ["identity_state/security/credential-requirements.md", "identity_state/security/secret-boundaries.md", "identity_state/security/credential-request.schema.json"],
          runtime_use: "credential requirements, secret boundaries, and binding request metadata without secrets",
          current_operations: ["semfs_create_credential_binding_request", "semfs_create_review_packet", "semfs_record_capability_gap"],
          needed_operations: ["semfs_record_credential_binding_event"],
          mutation_posture: "non-secret credential binding requests are available; credential paths and secrets remain blocked",
        },
        {
          key: "payments",
          map_ref: "identity_state/payments/MAP.md",
          primary_refs: ["identity_state/payments/payment-capability.md", "identity_state/payments/402-payment-flow.md", "identity_state/payments/payment-compliance.md", "identity_state/payments/payment-authorization-matrix.md"],
          runtime_use: "payment-required behavior, compliance, review, and provider-bound runtime actions",
          current_operations: ["semfs_create_review_packet", "semfs_record_capability_gap", "semfs_create_capability_proposal"],
          needed_operations: ["semfs_create_payment_setup_request", "semfs_record_payment_event", "semfs_prepare_payment_review"],
          mutation_posture: "payment writes and live payment actions are blocked; setup/review summaries need dedicated operations",
        },
        {
          key: "skills_and_specialists",
          map_ref: "identity_state/skills/MAP.md",
          primary_refs: ["identity_state/skills/known-skills.md", "identity_state/skills/skill-gaps.md", "identity_state/registries/specialists.json"],
          runtime_use: "durable capability descriptions and specialist proposals that may later inform agent/tool activation",
          current_operations: ["semfs_prepare_dream", "semfs_validate_dream", "semfs_write_safe_dream_outputs", "semfs_record_capability_gap", "semfs_create_capability_proposal"],
          needed_operations: ["semfs_record_skill_gap", "semfs_create_specialist_proposal", "semfs_activate_specialist"],
          mutation_posture: "gap/proposal capture exists; specialist and skill activation are missing",
        },
      ],
      recommended_next_functions: [
        "semfs_apply_reviewed_context",
        "semfs_apply_authority_policy_update",
        "semfs_record_usage_rollup",
        "semfs_record_credential_binding_event",
        "semfs_activate_tool",
        "semfs_activate_specialist",
        "semfs_activate_memory_namespace",
      ],
    };
  }

  private async optionalJson<T = Record<string, unknown>>(store: IdentityMount["store"], relPath: string): Promise<T | null> {
    try {
      return JSON.parse(await store.readText(relPath)) as T;
    } catch {
      return null;
    }
  }
}
