import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { beforeEach, describe, expect, it } from "vitest";
import { selectMcpPrincipal } from "../src/mcp/principal.js";
import { createContainer } from "../src/services/container.js";
import { createApp } from "../src/server/app.js";
import { SeedTemplateService } from "../src/services/seed-template-service.js";
import { IdentityStore } from "../src/types/core.js";

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
    delete process.env.SEMFS_MCP_AUTH_TOKEN;
    delete process.env.SEMFS_VECTOR_FILE_DIR;
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

  it("prepares compact inbound packets", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    const container = createContainer();

    const before = await container.inbound.prepare(container.registry.resolve("test-identity"), { message: "Hello" });
    expect(before.state).toBe("uninitialized");

    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    const packet = await container.inbound.prepare(container.registry.resolve("test-identity"), {
      message: "Hello",
      owner_verified: false,
    });

    expect(packet.state).toBe("ready");
    expect((packet.selected as Record<string, unknown>).route).toBe("clarify_intent");
    expect((packet.selected as Record<string, unknown>).agent_id).toBe("owner_onboarding");
    expect(((packet.response_rules as Record<string, unknown>).posture as Record<string, unknown>).name).toBe("seed_warm_clarification");
    expect(JSON.stringify((packet.response_rules as Record<string, unknown>).posture)).not.toContain("tell me what this identity should become");
    expect(JSON.stringify(packet)).not.toContain("baseline_internal_tools");
    expect(JSON.stringify(packet)).toContain("Runtime User-Facing Guard");
    expect(JSON.stringify(packet)).toContain("canonical owner identity seed update tool");

    const profileRequest = await container.inbound.prepare(container.registry.resolve("test-identity"), {
      message: "Owner profile setup request",
      intent: "identity_profile_update",
      owner_verified: false,
    });
    expect((profileRequest.selected as Record<string, unknown>).route).toBe("clarify_intent");
    expect(((profileRequest.response_rules as Record<string, unknown>).posture as Record<string, unknown>).name).toBe(
      "seed_unverified_or_readonly_intake"
    );
  });

  it("serves compact inbound prep over REST", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    process.env.SEMFS_RUNTIME_AUTH_TOKEN = "runtime-token";
    process.env.SEMFS_OWNER_RUNTIME_AUTH_TOKEN = "owner-runtime-token";
    const container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    const app = await createApp(container);

    const inbound = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/inbound/prepare",
      headers: { authorization: "Bearer runtime-token" },
      payload: { message: "How are you?" },
    });

    expect(inbound.statusCode).toBe(200);
    expect(inbound.json().selected.route).toBe("clarify_intent");
    expect(inbound.json().access.token_class).toBe("runtime");
    expect(inbound.json().response_rules.posture.owner_verification).toBe("not_required_for_greeting_or_safe_clarification");

    const ownerStatus = await app.inject({
      method: "GET",
      url: "/v1/identities/test-identity/status",
      headers: { authorization: "Bearer owner-runtime-token" },
    });

    expect(ownerStatus.statusCode).toBe(200);
    expect(ownerStatus.json().auth.token_class).toBe("owner_runtime");
    expect(ownerStatus.json().auth.owner_verified_by_credential).toBe(true);
    expect(ownerStatus.json().recommended_next.tool).toBe("semfs_prepare_inbound");
    expect(ownerStatus.json().can_answer_inbound_from_status).toBe(false);
    expect(ownerStatus.json().runtime_instruction).toContain("Do not ask for separate owner verification");

    const runtimeIdentityShapingInbound = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/inbound/prepare",
      headers: { authorization: "Bearer runtime-token" },
      payload: { message: "Owner profile setup request", intent: "identity_profile_update" },
    });

    expect(runtimeIdentityShapingInbound.statusCode).toBe(200);
    expect(runtimeIdentityShapingInbound.json().access.token_class).toBe("runtime");
    expect(runtimeIdentityShapingInbound.json().inbound.owner_verified).toBe(false);
    expect(runtimeIdentityShapingInbound.json().response_rules.posture.name).toBe("seed_expected_runtime_intake");
    expect(JSON.stringify(runtimeIdentityShapingInbound.json().response_rules.posture)).toContain("draft profile");

    const ownerInbound = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/inbound/prepare",
      headers: { authorization: "Bearer owner-runtime-token" },
      payload: { message: "Owner profile setup request", intent: "identity_profile_update" },
    });

    expect(ownerInbound.statusCode).toBe(200);
    expect(ownerInbound.json().access.token_class).toBe("owner_runtime");
    expect(ownerInbound.json().inbound.owner_verified).toBe(true);
    expect(ownerInbound.json().selected.route).toBe("owner_onboarding");
    expect(ownerInbound.json().response_rules.posture.name).toBe("seed_verified_owner_intake");
    expect(ownerInbound.json().response_rules.action_guidance.owner_input_capture.preferred_tools).toContain("semfs_apply_owner_identity_seed");

    const ownerApprovalContinuation = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/inbound/prepare",
      headers: { authorization: "Bearer owner-runtime-token" },
      payload: { message: "Decision response", decision: "accept", conversation_id: "profile-setup" },
    });
    expect(ownerApprovalContinuation.statusCode).toBe(200);
    expect(ownerApprovalContinuation.json().selected.route).toBe("owner_onboarding");
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
    expect(status.json().auth.token_class).toBe("runtime");
    expect(status.json().recommended_next.tool).toBe("semfs_prepare_inbound");
    expect(status.json().memory.durable).toBe(true);

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
    process.env.SEMFS_ADMIN_AUTH_TOKEN = "admin-token";
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
      headers: { authorization: "Bearer admin-token" },
      payload: { identity_id: "test-identity" },
    });
    expect(adminInit.statusCode).toBe(409);

    const defaultTokenInit = await app.inject({
      method: "POST",
      url: "/v1/identities/initialize",
      headers: { authorization: "Bearer test-token" },
      payload: { identity_id: "test-identity" },
    });
    expect(defaultTokenInit.statusCode).toBe(403);
  });

  it("rejects duplicate auth tokens and selects scoped MCP principals", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    process.env.SEMFS_RUNTIME_AUTH_TOKEN = "runtime-token";
    process.env.SEMFS_OWNER_RUNTIME_AUTH_TOKEN = "owner-runtime-token";
    const container = createContainer();

    expect(selectMcpPrincipal(container).tokenClass).toBe("owner_runtime");
    expect(selectMcpPrincipal(container, "runtime-token").tokenClass).toBe("runtime");

    process.env.SEMFS_OWNER_RUNTIME_AUTH_TOKEN = "test-token";
    expect(() => createContainer()).toThrow(/Duplicate SemFS auth token/);
  });

  it("applies owner-approved identity seed updates through owner runtime only", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    process.env.SEMFS_OWNER_RUNTIME_AUTH_TOKEN = "owner-runtime-token";
    const container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    const app = await createApp(container);

    const denied = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/owner/seed",
      headers: { authorization: "Bearer test-token" },
      payload: { display_name: "Owner Profile" },
    });
    expect(denied.statusCode).toBe(403);

    const applied = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/owner/seed",
      headers: { authorization: "Bearer owner-runtime-token" },
      payload: {
        display_name: "Owner Profile",
        profile_summary: "Owner-approved operating profile summary.",
        primary_purpose: "Represent the owner-approved operating identity and mature into a safe identity operating system.",
        business_or_function_domain: "owner-approved operating domain",
        audience_or_market: "owner-approved audience",
        tone: ["plain-spoken", "operator-like", "practical"],
        owner_approved_facts: ["Owner-approved fact one", "Owner-approved fact two"],
        boundaries: ["Do not send externally or publish without explicit approval"],
        conversation_id: "profile-setup",
      },
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json().ok).toBe(true);

    const profile = JSON.parse(await fs.readFile(path.join(root, "identity_state/profile/current.json"), "utf8"));
    expect(profile.display_name).toBe("Owner Profile");
    expect(profile.current_context_depth).toBe("owner_seed_profile_captured");
    expect(await fs.readFile(path.join(root, "README.md"), "utf8")).toContain("Owner Profile");
    expect(await fs.readFile(path.join(root, "conversations/profile-setup/artifacts/owner-identity-seed-update.md"), "utf8")).toContain("Owner Identity Seed Update");
  });

  it("stores memory durably under .memory and reports memory status", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    let container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    let mount = container.registry.resolve("test-identity");
    let bundle = await container.loader.load(mount);

    const upsert = await container.vectors.upsert(bundle, {
      namespace: "identity-profile-history",
      summary: "Owner profile summary for durable memory.",
      source_agent: "context_collector",
    });
    expect(upsert.durable).toBe(true);
    expect(await fs.readFile(path.join(root, ".memory/vector/test-identity/identity-profile-history.jsonl"), "utf8")).toContain("Owner profile");

    container = createContainer();
    mount = container.registry.resolve("test-identity");
    bundle = await container.loader.load(mount);
    const search = await container.vectors.search(bundle, { namespace: "identity-profile-history", query: "Owner profile" });
    expect((search.records as unknown[]).length).toBe(1);
    expect(container.vectors.status(bundle).durable).toBe(true);

    const app = await createApp(container);
    const memoryStatus = await app.inject({
      method: "GET",
      url: "/v1/identities/test-identity/memory/status",
      headers: { authorization: "Bearer test-token" },
    });
    expect(memoryStatus.statusCode).toBe(200);
    expect(memoryStatus.json().memory.storage.location).toBe("identity_repo_dot_memory");

    const gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8");
    expect(gitignore).toContain(".memory/");
  });

  it("requires an explicit memory file dir for non-local identity backends", () => {
    process.env.SEMFS_IDENTITY_BACKEND = "github";
    delete process.env.SEMFS_VECTOR_FILE_DIR;
    expect(() => createContainer()).toThrow(/SEMFS_VECTOR_FILE_DIR is required/);
  });

  it("rejects overlapping token values across credential classes", () => {
    process.env.SEMFS_AUTH_TOKEN = "shared-token";
    process.env.SEMFS_OWNER_RUNTIME_AUTH_TOKEN = "shared-token";
    expect(() => createContainer()).toThrow(/Duplicate SemFS auth token/);
  });

  it("initializes seed templates through bulk store writes when available", async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const store: IdentityStore = {
      kind: "local",
      label: "bulk-test-store",
      readText: async () => "",
      writeText: async () => {
        throw new Error("writeText should not be used when writeManyText is available");
      },
      writeManyText: async (files) => {
        writes.push(...files);
        return files.map((file) => ({ path: file.path, wrote: true }));
      },
      exists: async () => false,
      listFiles: async () => [],
    };
    const service = new SeedTemplateService({ createStoreFromTarget: () => store } as never);

    const result = await service.initialize({ identity_id: "bulk-identity", display_name: "Bulk Identity" });

    expect(result.files_written).toBeGreaterThan(100);
    expect(writes.length).toBe(result.files_written);
    expect(writes.some((write) => write.path === "identity_state/lifecycle/current.json")).toBe(true);
    expect(writes.some((write) => write.content.includes("bulk-identity"))).toBe(true);
  });

  it("keeps seed owner onboarding natural by default", async () => {
    const prompt = await fs.readFile("templates/seed/identity_state/prompts/agents/owner-onboarding.md", "utf8");

    expect(prompt).toContain("Write naturally");
    expect(prompt).toContain("identity formation");
    expect(prompt).not.toContain("Use short sections:");
  });

  it("applies verified-owner seed identity updates to canonical profile surfaces", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    process.env.SEMFS_RUNTIME_AUTH_TOKEN = "runtime-token";
    process.env.SEMFS_OWNER_RUNTIME_AUTH_TOKEN = "owner-runtime-token";
    const container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });
    const app = await createApp(container);

    const runtimeAttempt = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/profile/apply-owner-seed",
      headers: { authorization: "Bearer runtime-token" },
      payload: { display_name: "Owner Profile" },
    });
    expect(runtimeAttempt.statusCode).toBe(403);

    const ownerUpdate = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/profile/apply-owner-seed",
      headers: { authorization: "Bearer owner-runtime-token" },
      payload: {
        display_name: "Owner Profile",
        represented_entity: "Owner Profile",
        primary_purpose: "help builders understand tools and make decisions",
        business_or_function_domain: "owner-approved operating domain",
        audience_or_market: "owner-approved audience",
        profile_summary: "Owner Profile - a concise, practical communicator who helps builders understand tools and make decisions.",
        voice_summary: "concise, practical, warm, builder-oriented",
        tone: ["concise", "practical", "warm", "builder-oriented"],
        owner_instruction: "Use the owner-approved seed profile for now.",
        conversation_id: "test-conversation",
      },
    });

    expect(ownerUpdate.statusCode).toBe(200);
    expect(ownerUpdate.json().profile.display_name).toBe("Owner Profile");
    expect(ownerUpdate.json().approvals.profile_seed_update_required).toBe(false);

    const freshContainer = createContainer();
    const mount = freshContainer.registry.resolve("test-identity");
    const bundle = await freshContainer.loader.load(mount);
    expect(bundle.profile?.display_name).toBe("Owner Profile");
    expect(bundle.profile?.current_context_depth).toBe("owner_seed_profile_captured");
    expect((bundle.status?.identity as Record<string, unknown>).display_name).toBe("Owner Profile");

    const readme = await fs.readFile(path.join(root, "README.md"), "utf8");
    const brief = await fs.readFile(path.join(root, "identity/context/identity-brief.md"), "utf8");
    const audit = await fs.readFile(path.join(root, "conversations/test-conversation/artifacts/owner-identity-seed-update.md"), "utf8");
    expect(readme).toContain("# Owner Profile");
    expect(brief).toContain("Owner Profile - a concise, practical communicator");
    expect(audit).toContain("Use the owner-approved seed profile for now.");

    const runtimeInbound = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/inbound/prepare",
      headers: { authorization: "Bearer runtime-token" },
      payload: { message: "Hello" },
    });
    expect(runtimeInbound.statusCode).toBe(200);
    expect(runtimeInbound.json().response_rules.posture.name).toBe("seed_profile_captured_runtime_intake");
    expect(JSON.stringify(runtimeInbound.json().response_rules.posture)).not.toContain("tell me what this identity should become");
    expect(JSON.stringify(runtimeInbound.json().response_rules.posture)).toContain("current identity");

    const ownerVerifiedRuntimeInbound = await app.inject({
      method: "POST",
      url: "/v1/identities/test-identity/inbound/prepare",
      headers: { authorization: "Bearer runtime-token" },
      payload: { message: "Hello", owner_verified: true, trust_level: "verified_owner" },
    });
    expect(ownerVerifiedRuntimeInbound.statusCode).toBe(200);
    expect(ownerVerifiedRuntimeInbound.json().inbound.owner_verified).toBe(true);
    expect(ownerVerifiedRuntimeInbound.json().response_rules.posture.name).toBe("seed_warm_clarification");
    expect(JSON.stringify(ownerVerifiedRuntimeInbound.json().response_rules.posture)).toContain("tell me what this identity should become");
  });

  it("ships a valid Render blueprint", async () => {
    const yaml = await fs.readFile("deploy/render/render.yaml", "utf8");
    const blueprint = parse(yaml) as { services?: Array<Record<string, unknown>> };
    expect(blueprint.services?.[0]?.healthCheckPath).toBe("/health");
    expect(blueprint.services?.[0]?.buildCommand).toBe("corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm build");
    expect(blueprint.services?.[0]?.startCommand).toBe("node dist/index.js");
  });
});
