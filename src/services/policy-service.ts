import { IdentityBundle } from "./identity-loader.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { hasDottedPath, setDottedPath } from "../utils/path.js";

const ACTIVATION_PATTERNS = [
  "activate",
  "activation",
  "lifecycle_mode_change",
  "registry_edit",
  "external_send",
  "payment",
  "credential",
  "publish",
  "scheduling",
  "pricing",
  "capability_activation",
  "tool_activation",
  "specialist_activation",
  "agent_activation",
];

export class PolicyService {
  activeRoutes(bundle: IdentityBundle): Record<string, Record<string, unknown>> {
    const dispatch = bundle.dispatch_map;
    const activeMode = String(dispatch.active_lifecycle_mode ?? bundle.lifecycle.current_mode ?? "unknown");
    const lifecycleModes = dispatch.lifecycle_modes as Record<string, { routes?: Record<string, Record<string, unknown>> }> | undefined;
    return lifecycleModes?.[activeMode]?.routes ?? (dispatch.routes as Record<string, Record<string, unknown>> | undefined) ?? {};
  }

  resolveRoute(bundle: IdentityBundle, route: string): Record<string, unknown> {
    const routes = this.activeRoutes(bundle);
    const routeInfo = routes[route];
    if (!routeInfo) throw forbidden(`Route is not active for lifecycle mode: ${route}`);
    return routeInfo;
  }

  normalizeTool(bundle: IdentityBundle, tool: string): string {
    const aliases = bundle.tool_aliases?.aliases as Record<string, string> | undefined;
    return aliases?.[tool] ?? tool;
  }

  agentRecord(bundle: IdentityBundle, agentId: string): Record<string, unknown> {
    const agents = (bundle.agents_registry.agents as Record<string, unknown>[] | undefined) ?? [];
    const agent = agents.find((entry) => entry.id === agentId);
    if (!agent) throw notFound(`Unknown or inactive agent: ${agentId}`);
    return agent;
  }

  toolsForAgent(bundle: IdentityBundle, agentId: string): Record<string, unknown>[] {
    const agent = this.agentRecord(bundle, agentId);
    const agentTools = new Set((agent.tools as string[] | undefined) ?? []);
    const allTools = (bundle.tools_registry.baseline_internal_tools as Record<string, unknown>[] | undefined) ?? [];
    return allTools.filter((tool) => agentTools.has(String(tool.id)));
  }

  authorizeTool(bundle: IdentityBundle, agentId: string, requestedTool: string): { allowed: boolean; tool: string; reason?: string } {
    const canonical = this.normalizeTool(bundle, requestedTool);
    const agent = this.agentRecord(bundle, agentId);
    if (agent.status !== "active") return { allowed: false, tool: canonical, reason: "agent is not active" };
    const tools = (agent.tools as string[] | undefined) ?? [];
    if (!tools.includes(canonical)) return { allowed: false, tool: canonical, reason: "tool not listed on agent" };
    const allTools = (bundle.tools_registry.baseline_internal_tools as Record<string, unknown>[] | undefined) ?? [];
    const registryTool = allTools.find((tool) => tool.id === canonical);
    const allowedAgents = (registryTool?.allowed_agents as string[] | undefined) ?? [];
    if (!registryTool || !allowedAgents.includes(agentId)) {
      return { allowed: false, tool: canonical, reason: "tool registry does not allow this agent" };
    }
    return { allowed: true, tool: canonical };
  }

  rejectActivationLike(action: string | undefined): void {
    const value = (action ?? "").toLowerCase();
    if (ACTIVATION_PATTERNS.some((pattern) => value.includes(pattern))) {
      throw forbidden("V1 blocks activation, external side effects, credentials, payments, publishing, lifecycle changes, and registry edits", {
        action,
      });
    }
  }

  validateOutput(bundle: IdentityBundle, agentId: string, output: Record<string, unknown>): Record<string, unknown> {
    const agent = this.agentRecord(bundle, agentId);
    const contractName = String(agent.output_contract ?? "");
    const contracts = bundle.output_contracts.contracts as Record<string, { required?: string[] }> | undefined;
    const contract = contracts?.[contractName];
    if (!contract) throw badRequest(`Missing output contract for agent: ${contractName}`);
    const missing = (contract.required ?? []).filter((field) => !hasDottedPath(output, field));
    if (missing.length) throw badRequest("Output is missing required contract fields", { missing });
    const nextRoute = ((output.decision as Record<string, unknown> | undefined)?.routing as Record<string, unknown> | undefined)?.next;
    if (typeof nextRoute === "string") this.resolveRoute(bundle, nextRoute);
    const facetTarget = String(agent.facet_target ?? "");
    const facets = output.facets as Record<string, unknown> | undefined;
    if (facets && facetTarget && facetTarget !== "none_runtime_decision_only") {
      const allowedFacetKeys = new Set([facetTarget, "vector_upsert", "human_review", "pending_approval", "trust_issue", "closeout", "expected"]);
      const unexpected = Object.keys(facets).filter((key) => !allowedFacetKeys.has(key));
      if (unexpected.length) throw badRequest("Output emits facets outside the agent facet policy", { unexpected, facet_target: facetTarget });
    }
    return { ok: true, contract: contractName, facet_target: facetTarget };
  }

  hydrate(bundle: IdentityBundle, contract: Record<string, unknown>, facets: Record<string, unknown>): Record<string, unknown> {
    const policy = bundle.facet_policy.facets as Record<string, { hydrate_to?: string }> | undefined;
    const hydrated = structuredClone(contract);
    for (const [facetName, value] of Object.entries(facets)) {
      const target = policy?.[facetName]?.hydrate_to;
      if (!target) throw badRequest(`Facet is not hydratable by policy: ${facetName}`);
      if (target.includes("runtime_contract.")) {
        setDottedPath(hydrated, target.replace(/^runtime_contract\./, ""), value);
      }
    }
    return hydrated;
  }
}
