import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SemfsContainer } from "../services/container.js";
import { SemfsError } from "../utils/errors.js";
import { createMcpServer } from "../mcp/server.js";

type Params = Record<string, string>;

export async function createApp(container: SemfsContainer): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

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
    const expected = `Bearer ${container.config.authToken}`;
    if (request.headers.authorization !== expected) {
      reply.status(401).send({ error: "unauthorized" });
    }
  });

  app.get("/health", async () => ({ ok: true, service: "semfs" }));

  app.post("/v1/identities/initialize", async (request) => {
    return container.seedTemplates.initialize((request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/mcp", async (request, reply) => {
    const mcpServer = createMcpServer(container);
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

  app.get("/v1/identities/:identity_id/manifest", async (request) => {
    const { mount, bundle } = await loadIdentity(container, request);
    return { mount: { identity_id: mount.identityId, store: mount.store.label }, manifest: container.loader.manifest(bundle) };
  });

  app.get("/v1/identities/:identity_id/context", async (request) => {
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

  app.get("/v1/identities/:identity_id/agents", async (request) => {
    const { bundle } = await loadIdentity(container, request);
    return container.agents.listAgents(bundle);
  });

  app.get("/v1/identities/:identity_id/agents/:agent_id", async (request) => {
    const { mount, bundle } = await loadIdentity(container, request);
    return container.agents.getAgent(mount, bundle, (request.params as Params).agent_id);
  });

  app.post("/v1/identities/:identity_id/agents/:agent_id/prepare-action", async (request) => {
    const { mount, bundle } = await loadIdentity(container, request);
    return container.agents.prepareAction(mount, bundle, (request.params as Params).agent_id, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/agents/:agent_id/authorize-action", async (request) => {
    const { bundle } = await loadIdentity(container, request);
    return container.agents.authorizeAction(bundle, (request.params as Params).agent_id, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/agents/:agent_id/validate-output", async (request) => {
    const { bundle } = await loadIdentity(container, request);
    return container.agents.validateOutput(bundle, (request.params as Params).agent_id, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/runs/prepare-planner", async (request) => {
    const { mount, bundle } = await loadIdentity(container, request);
    return container.agents.prepareAction(mount, bundle, "runtime_orchestration_planner", (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/runs/resolve-route", async (request) => {
    const { bundle } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const route = String(body.route ?? body.next ?? "");
    const routeInfo = container.policy.resolveRoute(bundle, route);
    return { identity_id: bundle.identity_id, route, route_info: routeInfo };
  });

  app.post("/v1/identities/:identity_id/runs/prepare-agent", async (request) => {
    const { mount, bundle } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const route = String(body.route ?? "");
    const routeInfo = container.policy.resolveRoute(bundle, route);
    return container.agents.prepareAction(mount, bundle, String(routeInfo.agent_id), { ...body, route });
  });

  app.post("/v1/identities/:identity_id/runs/hydrate", async (request) => {
    const { bundle } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      identity_id: bundle.identity_id,
      contract: container.policy.hydrate(bundle, (body.contract ?? {}) as Record<string, unknown>, (body.facets ?? {}) as Record<string, unknown>),
    };
  });

  app.post("/v1/identities/:identity_id/vector/upsert", async (request) => {
    const { bundle } = await loadIdentity(container, request);
    return container.vectors.upsert(bundle, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/vector/search", async (request) => {
    const { bundle } = await loadIdentity(container, request);
    return container.vectors.search(bundle, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/artifacts/write-safe", async (request) => {
    const { mount } = await loadIdentity(container, request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    return container.writer.writeSafe(mount, String(body.path ?? ""), String(body.content ?? ""), String(body.message ?? "semfs: safe artifact write"));
  });

  app.post("/v1/identities/:identity_id/review-packets", async (request) => {
    const { mount } = await loadIdentity(container, request);
    return container.writer.createReviewPacket(mount, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/approvals", async (request) => {
    const { mount } = await loadIdentity(container, request);
    return container.writer.captureApproval(mount, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/dreams/prepare", async (request) => {
    const { bundle } = await loadIdentity(container, request);
    return container.dreams.prepare(bundle, (request.body ?? {}) as Record<string, unknown>);
  });

  app.post("/v1/identities/:identity_id/dreams/validate", async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    return container.dreams.validate((body.findings ?? []) as never[]);
  });

  app.post("/v1/identities/:identity_id/dreams/write-safe", async (request) => {
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

export async function startServer(container: SemfsContainer): Promise<void> {
  const app = await createApp(container);
  await app.listen({ host: container.config.host, port: container.config.port });
}
