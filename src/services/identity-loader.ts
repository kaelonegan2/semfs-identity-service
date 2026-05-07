import { IdentityMount } from "../types/core.js";
import { readJson, readOptionalText } from "./json.js";

export interface IdentityBundle {
  identity_id: string;
  store_label: string;
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
  async load(mount: IdentityMount): Promise<IdentityBundle> {
    const store = mount.store;
    const lifecycle = await readJson<Record<string, unknown>>(store, "identity_state/lifecycle/current.json");
    const identityId = String(lifecycle.identity_id ?? mount.identityId);

    return {
      identity_id: identityId,
      store_label: store.label,
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

  private async optionalJson<T = Record<string, unknown>>(store: IdentityMount["store"], relPath: string): Promise<T | null> {
    try {
      return JSON.parse(await store.readText(relPath)) as T;
    } catch {
      return null;
    }
  }
}
