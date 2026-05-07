import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { beforeEach, describe, expect, it } from "vitest";
import { createContainer } from "../src/services/container.js";
import { createApp } from "../src/server/app.js";

async function tempIdentityRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "semfs-test-"));
}

describe("SemFS service", () => {
  beforeEach(() => {
    process.env.SEMFS_AUTH_TOKEN = "test-token";
    delete process.env.SEMFS_ADMIN_AUTH_TOKEN;
    delete process.env.SEMFS_OWNER_RUNTIME_AUTH_TOKEN;
    delete process.env.SEMFS_RUNTIME_AUTH_TOKEN;
    delete process.env.SEMFS_READONLY_AUTH_TOKEN;
    delete process.env.SEMFS_PUBLIC_AUTH_TOKEN;
    delete process.env.SEMFS_PUBLIC_ACCESS;
    delete process.env.SEMFS_AUTH_TOKENS;
    process.env.SEMFS_DEFAULT_IDENTITY_ID = "test-identity";
    process.env.SEMFS_IDENTITY_BACKEND = "local";
    process.env.SEMFS_VECTOR_STORE = "memory";
  });

  it("initializes and loads a seed identity", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    const container = createContainer();

    const before = await container.loader.status(container.registry.resolve("test-identity"));
    expect(before.state).toBe("uninitialized");
    expect(before.loadable).toBe(false);
    expect((before.recommended_next as Record<string, unknown>).tool).toBe("semfs_initialize_identity");

    await container.seedTemplates.initialize({
      identity_id: "test-identity",
      display_name: "Test Identity",
      target: { backend: "local", path: root },
    });

    const mount = container.registry.resolve("test-identity");
    const after = await container.loader.status(mount);
    expect(after.state).toBe("ready");
    expect(after.loadable).toBe(true);

    const bundle = await container.loader.load(mount);
    const manifest = container.loader.manifest(bundle);

    expect(bundle.identity_id).toBe("test-identity");
    expect(manifest.canonical_dispatch_map).toBe("identity_state/orchestration/dispatch-map.json");
    expect((manifest.active_routes as string[])).toContain("owner_onboarding");
  });

  it("retrieves agents and enforces tool permissions", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    const container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    const mount = container.registry.resolve("test-identity");
    const bundle = await container.loader.load(mount);

    const agent = await container.agents.getAgent(mount, bundle, "owner_onboarding");
    expect((agent.prompt as Record<string, unknown>).system).toContain("Owner Onboarding");

    const allowed = container.agents.authorizeAction(bundle, "owner_onboarding", { requested_tool: "repo_read" });
    expect(allowed.allowed).toBe(true);

    const denied = container.agents.authorizeAction(bundle, "owner_onboarding", { requested_tool: "semfs_vector_upsert" });
    expect(denied.allowed).toBe(false);
  });

  it("prepares dream packets and rejects activation-like findings", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    const container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    const mount = container.registry.resolve("test-identity");
    const bundle = await container.loader.load(mount);

    const packet = container.dreams.prepare(bundle, { scope: "capabilities" });
    expect(packet.scope).toBe("capabilities");

    expect(() =>
      container.dreams.validate([
        { type: "capability_gap", title: "Activate payment", summary: "activate payments now" },
      ])
    ).toThrow();
  });

  it("serves authenticated REST endpoints", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    const container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    const app = await createApp(container);

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const unauthorized = await app.inject({ method: "GET", url: "/v1/identities/test-identity/manifest" });
    expect(unauthorized.statusCode).toBe(401);

    const status = await app.inject({
      method: "GET",
      url: "/v1/identities/test-identity/status",
      headers: { authorization: "Bearer test-token" },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().state).toBe("ready");

    const manifest = await app.inject({
      method: "GET",
      url: "/v1/identities/test-identity/manifest",
      headers: { authorization: "Bearer test-token" },
    });
    expect(manifest.statusCode).toBe(200);
    expect(manifest.json().manifest.active_routes).toContain("owner_onboarding");

    const mcpGet = await app.inject({
      method: "GET",
      url: "/mcp",
      headers: { authorization: "Bearer test-token" },
    });
    expect(mcpGet.statusCode).toBe(405);
  });

  it("enforces token-derived REST scopes", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    process.env.SEMFS_RUNTIME_AUTH_TOKEN = "runtime-token";
    const container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    const app = await createApp(container);

    const status = await app.inject({
      method: "GET",
      url: "/v1/identities/test-identity/status",
      headers: { authorization: "Bearer runtime-token" },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().auth.token_class).toBe("runtime");

    const init = await app.inject({
      method: "POST",
      url: "/v1/identities/initialize",
      headers: { authorization: "Bearer runtime-token" },
      payload: { identity_id: "test-identity" },
    });
    expect(init.statusCode).toBe(403);

    const adminInit = await app.inject({
      method: "POST",
      url: "/v1/identities/initialize",
      headers: { authorization: "Bearer test-token" },
      payload: { identity_id: "test-identity" },
    });
    expect(adminInit.statusCode).toBe(409);
  });

  it("ships a valid Render blueprint", async () => {
    const yaml = await fs.readFile("deploy/render/render.yaml", "utf8");
    const blueprint = parse(yaml) as { services?: Array<Record<string, unknown>> };
    expect(blueprint.services?.[0]?.healthCheckPath).toBe("/health");
    expect(blueprint.services?.[0]?.buildCommand).toBe("corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm build");
    expect(blueprint.services?.[0]?.startCommand).toBe("node dist/index.js");
  });
});
