import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SemfsContainer } from "../services/container.js";
import { SemfsError } from "../utils/errors.js";
import { createMcpServer } from "../mcp/server.js";
import { AuthPrincipal, AuthScope, IdentityMount } from "../types/core.js";

type Params = Record<string, string>;

export async function createApp(container: SemfsContainer, options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof SemfsError) {
      reply.status(error.statusCode).send({ error: error.code, message: error.message, details: error.details });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    reply.status(500).send({ error: "internal_error", message });
  });

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health") return;
    const principal = container.auth.authenticate(request.headers.authorization);
    if (!principal) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    (request as FastifyRequest & { semfsAuth: AuthPrincipal }).semfsAuth = principal;
  });

  app.get("/health", async () => ({ ok: true, service: "semfs" }));

  app.post("/v1/identities/initialize", async (request) => {
    requireScope(container, request, "identity:initialize", "semfs_initialize_identity");
    return container.seedTemplates.initialize((request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/mcp", async (request, reply) => {
    const mcpServer = createMcpServer(container, authPrincipal(request));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
    reply.raw.on("close", () => {
      void transport.close();
      void mcpServer.close();
    });
    reply.hijack();
  });

  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  app.get("/v1/identities/:identity_id/status", async (request) => {
    requireScope(container, request, "identity:status", "semfs_get_identity_status");
    const mount = container.registry.resolve((request.params as Params).identity_id);
    const status = await container.loader.status(mount);
    return container.auth.statusResponse(status, authPrincipal(request), await statusExtras(container, mount, status));
  });

  app.post("/v1/identities/:identity_id/inbound/prepare", async (request) => {
    requireScope(container, request, "inbound:prepare", "semfs_prepare_inbound");
    const mount = container.registry.resolve((request.params as Params).identity_id);
    return container.inbound.prepare(mount, { ...((request.body ?? {}) as Record<string, unknown>), auth: authPrincipal(request) });
  });

  app.get("/v1/identities/:identity_id/manifest", async (request) => {
    requireScope(container, request, "identity:read", "semfs_get_manifest");
    const { mount, bundle } = await loadIdentity(container, request);
    return { mount: { identity_id: mount.identityId, store: mount.store.label }, manifest: container.loader.manifest(bundle) };
  });

  app.get("/v1/identities/:identity_id/context", async (request) => {
    requireScope(container, request, "identity:read", "semfs_get_manifest");
    const { bundle } = await loadIdentity(container, request);
    return {
      identity_id: bundle.identity_id,
      lifecycle: bundle.lifecycle,
      profile: bundle.profile,
      status: bundle.status,
      roles: bundle.roles_markdown,
      skills: bundle.skills_markdown,
      vector_namespaces: bundle.vector_namespaces,
    };
  });

  app.get("/v1/identities/:identity_id/inspection", async (request) => {
    requireScope(container, request, "identity:read", "semfs_inspect_identity");
    const mount = container.registry.resolve((request.params as Params).identity_id);
    const query = request.query as { format?: string; eval_index?: string };
    const report = await container.inspection.inspect(mount, {
      include_human_markdown: query.format !== "json",
      eval_results_root: query.eval_index,
    });
    if (query.format === "markdown") {
      return {
        identity_id: report.identity_id,
        overall_status: report.overall_status,
        markdown: report.human_report_markdown ?? container.inspection.toMarkdown(report),
      };
    }
    return report;
  });

  app.post("/v1/identities/:identity_id/profile/apply-owner-seed", async (request) => {
    requireAnyScope(container, request, ["identity:profile_write", "identity:seed_update"], "semfs_apply_owner_identity_seed");
    const mount = container.registry.resolve((request.params as Params).identity_id);
    return container.identityProfile.applyOwnerIdentitySeed(mount, authPrincipal(request), (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/owner/seed", async (request) => {
    requireAnyScope(container, request, ["identity:profile_write", "identity:seed_update"], "semfs_apply_owner_identity_seed");
    const mount = container.registry.resolve((request.params as Params).identity_id);
    return container.identityProfile.applyOwnerIdentitySeed(mount, authPrincipal(request), (request.body ?? {}) as Record<string, unknown>);
  });

  app.get("/v1/identities/:identity_id/agents", async (request) => {
    requireScope(container, request, "agent:read", "semfs_get_agent");
    const { bundle } = await loadIdentity(container, request);
    return container.agents.listAgents(bundle);
  });

  app.get("/v1/identities/:identity_id/agents/:agent_id", async (request) => {
    requireScope(container, request, "agent:read", "semfs_get_agent");
    const { mount, bundle } = await loadIdentity(container, request);
    return container.agents.getAgent(mount, bundle, (request.params as Params).agent_id);
  });

  app.post("/v1/identities/:identity_id/agents/:agent_id/prepare-action", async (request) => {
    requireScope(container, request, "agent:prepare", "semfs_prepare_agent_action");
    const { mount, bundle } = await loadIdentity(container, request);
    return container.agents.prepareAction(mount, bundle, (request.params as Params).agent_id, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/agents/:agent_id/authorize-action", async (request) => {
    requireScope(container, request, "agent:authorize", "semfs_authorize_agent_action");
    const { bundle } = await loadIdentity(container, request);
    return container.agents.authorizeAction(bundle, (request.params as Params).agent_id, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/agents/:agent_id/validate-output", async (request) => {
    requireScope(container, request, "agent:validate", "semfs_validate_agent_output");
    const { bundle } = await loadIdentity(container, request);
    return container.agents.validateOutput(bundle, (request.params as Params).agent_id, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/runs/prepare-planner", async (request) => {
    requireScope(container, request, "run:prepare", "semfs_prepare_agent_action");
    const { mount, bundle } = await loadIdentity(container, request);
    return container.agents.prepareAction(mount, bundle, "runtime_orchestration_planner", (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/runs/resolve-route", async (request) => {
    requireScope(container, request, "run:prepare", "semfs_prepare_agent_action");
    const { bundle } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const route = String(body.route ?? body.next ?? "");
    const routeInfo = container.policy.resolveRoute(bundle, route);
    return { identity_id: bundle.identity_id, route, route_info: routeInfo };
  });

  app.post("/v1/identities/:identity_id/runs/prepare-agent", async (request) => {
    requireScope(container, request, "run:prepare", "semfs_prepare_agent_action");
    const { mount, bundle } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const route = String(body.route ?? "");
    const routeInfo = container.policy.resolveRoute(bundle, route);
    return container.agents.prepareAction(mount, bundle, String(routeInfo.agent_id), { ...body, route });
  });

  app.post("/v1/identities/:identity_id/runs/hydrate", async (request) => {
    requireScope(container, request, "run:prepare", "semfs_prepare_agent_action");
    const { bundle } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      identity_id: bundle.identity_id,
      contract: container.policy.hydrate(bundle, (body.contract ?? {}) as Record<string, unknown>, (body.facets ?? {}) as Record<string, unknown>),
    };
  });

  app.post("/v1/identities/:identity_id/runtime/capabilities", async (request) => {
    requireScope(container, request, "runtime:capability_write", "semfs_record_runtime_capabilities");
    const { mount, bundle } = await loadIdentity(container, request);
    return container.runtime.recordRuntimeCapabilities(mount, bundle, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/runs/prepare-orchestration", async (request) => {
    requireScope(container, request, "run:orchestrate", "semfs_prepare_orchestration_run");
    const { mount, bundle } = await loadIdentity(container, request);
    return container.runtime.prepareOrchestrationRun(mount, bundle, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/runs/prepare-subagent", async (request) => {
    requireScope(container, request, "run:orchestrate", "semfs_prepare_subagent_run");
    const { mount, bundle } = await loadIdentity(container, request);
    return container.runtime.prepareSubagentRun(mount, bundle, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/runs/events", async (request) => {
    requireScope(container, request, "run:record", "semfs_record_agent_run_event");
    const { mount } = await loadIdentity(container, request);
    return container.runtime.recordAgentRunEvent(mount, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/runs/results", async (request) => {
    requireScope(container, request, "run:record", "semfs_record_agent_run_result");
    const { mount } = await loadIdentity(container, request);
    return container.runtime.recordAgentRunResult(mount, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/context/owner", async (request) => {
    requireScope(container, request, "context:write", "semfs_record_owner_context");
    const { mount } = await loadIdentity(container, request);
    return container.runtime.recordOwnerContext(mount, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/context/inbound", async (request) => {
    requireScope(container, request, "context:write", "semfs_record_inbound_context");
    const { mount } = await loadIdentity(container, request);
    return container.runtime.recordInboundContext(mount, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/capability-gaps", async (request) => {
    requireScope(container, request, "evolution:write", "semfs_record_capability_gap");
    const { mount, bundle } = await loadIdentity(container, request);
    return container.runtime.recordCapabilityGap(mount, bundle, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/capability-proposals", async (request) => {
    requireScope(container, request, "evolution:write", "semfs_create_capability_proposal");
    const { mount, bundle } = await loadIdentity(container, request);
    return container.runtime.createCapabilityProposal(mount, bundle, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/approvals/link-artifact", async (request) => {
    requireScope(container, request, "approval:write", "semfs_link_approval_to_artifact");
    const { mount } = await loadIdentity(container, request);
    return container.runtime.linkApprovalToArtifact(mount, (request.body ?? {}) as Record<string, unknown>, authPrincipal(request));
  });

  app.post("/v1/identities/:identity_id/vector/upsert", async (request) => {
    requireScope(container, request, "memory:write", "semfs_vector_upsert");
    const { bundle } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    container.auth.requireVectorNamespace(authPrincipal(request), String(body.namespace ?? ""));
    return container.vectors.upsert(bundle, body);
  });

  app.post("/v1/identities/:identity_id/vector/search", async (request) => {
    requireScope(container, request, "memory:search", "semfs_vector_search");
    const { bundle } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    container.auth.requireVectorNamespace(authPrincipal(request), String(body.namespace ?? ""));
    return container.vectors.search(bundle, body);
  });

  app.get("/v1/identities/:identity_id/memory/status", async (request) => {
    requireScope(container, request, "memory:search", "semfs_get_memory_status");
    const { bundle } = await loadIdentity(container, request);
    return { identity_id: bundle.identity_id, memory: container.vectors.status(bundle) };
  });

  app.post("/v1/identities/:identity_id/artifacts/write-safe", async (request) => {
    requireScope(container, request, "artifact:safe_write", "semfs_write_safe_artifact");
    const { mount } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    return container.writer.writeSafe(mount, String(body.path ?? ""), String(body.content ?? ""), String(body.message ?? "semfs: safe artifact write"));
  });

  app.post("/v1/identities/:identity_id/review-packets", async (request) => {
    requireScope(container, request, "review:write", "semfs_create_review_packet");
    const { mount } = await loadIdentity(container, request);
    return container.writer.createReviewPacket(mount, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/approvals", async (request) => {
    requireScope(container, request, "approval:write", "semfs_capture_approval");
    const { mount } = await loadIdentity(container, request);
    return container.writer.captureApproval(mount, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/dreams/prepare", async (request) => {
    requireScope(container, request, "dream:prepare", "semfs_prepare_dream");
    const { bundle } = await loadIdentity(container, request);
    return container.dreams.prepare(bundle, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/dreams/validate", async (request) => {
    requireScope(container, request, "dream:validate", "semfs_validate_dream");
    const body = (request.body ?? {}) as Record<string, unknown>;
    return container.dreams.validate((body.findings ?? []) as never[]);
  });

  app.post("/v1/identities/:identity_id/dreams/write-safe", async (request) => {
    requireScope(container, request, "dream:write", "semfs_write_safe_dream_outputs");
    const { mount } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    return container.dreams.writeSafe(mount, (body.findings ?? []) as never[]);
  });

  return app;
}

async function methodNotAllowed(_request: FastifyRequest, reply: FastifyReply) {
  reply.status(405).send({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST /mcp for stateless MCP Streamable HTTP." },
    id: null,
  });
}

async function loadIdentity(container: SemfsContainer, request: FastifyRequest) {
  const params = request.params as Params;
  const mount = container.registry.resolve(params.identity_id);
  const bundle = await container.loader.load(mount);
  return { mount, bundle };
}

async function statusExtras(container: SemfsContainer, mount: IdentityMount, status: Record<string, unknown>) {
  if (status.state !== "ready") return { memory: container.vectors.status(null) };
  const bundle = await container.loader.load(mount);
  return { memory: container.vectors.status(bundle) };
}

function authPrincipal(request: FastifyRequest): AuthPrincipal {
  return (request as FastifyRequest & { semfsAuth: AuthPrincipal }).semfsAuth;
}

function requireScope(container: SemfsContainer, request: FastifyRequest, scope: AuthScope, toolName?: string): void {
  const principal = authPrincipal(request);
  container.auth.requireScope(principal, scope);
  if (toolName) container.auth.requireTool(principal, toolName);
}

function requireAnyScope(container: SemfsContainer, request: FastifyRequest, scopes: AuthScope[], toolName?: string): void {
  const principal = authPrincipal(request);
  if (!scopes.some((scope) => container.auth.hasScope(principal, scope))) container.auth.requireScope(principal, scopes[0]);
  if (toolName) container.auth.requireTool(principal, toolName);
}

export async function startServer(container: SemfsContainer): Promise<void> {
  const app = await createApp(container);
  await app.listen({ host: container.config.host, port: container.config.port });
}
