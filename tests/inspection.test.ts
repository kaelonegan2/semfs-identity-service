import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { createContainer } from "../src/services/container.js";
import { LocalIdentityStore } from "../src/stores/local-store.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/server.js";

const adversarialRoot = path.resolve("tests/fixtures/inspection/adversarial-identity");
const failingEvalIndex = path.resolve("tests/fixtures/inspection/failing-eval-index.json");

async function tempIdentityRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "semfs-inspect-"));
}

describe("SemFS self-inspection", () => {
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

  it("inspects an initialized seed identity and returns a schema-versioned report", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    const container = createContainer();
    await container.seedTemplates.initialize({
      identity_id: "test-identity",
      target: { backend: "local", path: root },
    });
    const mount = container.registry.resolve("test-identity");
    const report = await container.inspection.inspect(mount, { include_human_markdown: true });

    expect(report.schema_version).toBe("identity_inspection_report.v1");
    expect(report.identity_id).toBe("test-identity");
    expect(report.checks_run.length).toBeGreaterThan(5);
    expect(report.human_report_markdown).toContain("SemFS Identity Inspection Report");
    expect(report.findings.some((finding) => finding.finding_type === "convention_uncertainty")).toBe(true);
    expect(
      report.findings.some((finding) =>
        finding.summary.toLowerCase().includes("payment_request is an active route")
      )
    ).toBe(false);
  });

  it("detects adversarial structural failures without treating vector falsehoods as truth", async () => {
    process.env.SEMFS_IDENTITY_PATH = adversarialRoot;
    const container = createContainer();
    const mount = {
      identityId: "adversarial-identity",
      store: new LocalIdentityStore(adversarialRoot),
    };
    const report = await container.inspection.inspect(mount, {
      include_human_markdown: true,
      eval_results_root: failingEvalIndex,
    });

    expect(report.overall_status).toBe("violations");
    const types = new Set(report.findings.map((finding) => finding.finding_type));
    expect(types.has("missing_canonical_file")).toBe(true);
    expect(types.has("invalid_ref")).toBe(true);
    expect(types.has("unmapped_file")).toBe(true);
    expect(types.has("capability_without_impl")).toBe(true);
    expect(types.has("impl_without_eval")).toBe(true);
    expect(types.has("eval_failing")).toBe(true);
    expect(types.has("eval_stale")).toBe(true);
    expect(types.has("open_task_issue")).toBe(true);
    expect(types.has("governance_contradiction")).toBe(true);
    expect(types.has("schema_violation")).toBe(true);
    expect(types.has("stale_doc")).toBe(true);
    expect(types.has("convention_uncertainty")).toBe(true);

    expect(report.findings.some((finding) => finding.subject_ref === "unmapped-secret-note.md")).toBe(true);
    expect(report.findings.some((finding) => finding.summary.includes("payment_request is an active route"))).toBe(false);
    expect(report.findings.some((finding) => finding.subject_ref === "docs/does-not-exist.md")).toBe(true);
    expect(report.findings.some((finding) => finding.finding_type === "eval_failing")).toBe(true);
  });

  it("exposes inspection over REST under identity:read", async () => {
    process.env.SEMFS_IDENTITY_PATH = adversarialRoot;
    process.env.SEMFS_DEFAULT_IDENTITY_ID = "adversarial-identity";
    const container = createContainer();
    // Point the default local store at the adversarial fixture via env path.
    const app = await createApp(container, { logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/v1/identities/adversarial-identity/inspection?format=json",
      headers: { authorization: "Bearer test-token" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.schema_version).toBe("identity_inspection_report.v1");
    expect(body.overall_status).toBe("violations");
  });

  it("exposes semfs_inspect_identity as an MCP tool for readonly credentials", async () => {
    const root = await tempIdentityRoot();
    process.env.SEMFS_IDENTITY_PATH = root;
    process.env.SEMFS_READONLY_AUTH_TOKEN = "readonly-token";
    const container = createContainer();
    await container.seedTemplates.initialize({ identity_id: "test-identity", target: { backend: "local", path: root } });

    const principal = container.auth.authenticate("Bearer readonly-token")!;
    const server = createMcpServer(container, principal);
    const client = new Client({ name: "inspect-test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("semfs_inspect_identity");
      const result = await client.callTool({
        name: "semfs_inspect_identity",
        arguments: { identity_id: "test-identity", include_human_markdown: false },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      const report = JSON.parse(text);
      expect(report.schema_version).toBe("identity_inspection_report.v1");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
