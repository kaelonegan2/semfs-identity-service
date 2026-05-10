import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FastifyInstance } from "fastify";
import { createApp } from "../server/app.js";
import { createContainer } from "../services/container.js";

export type RuntimeEvalPrincipal =
  | "runtime"
  | "owner_runtime"
  | "admin"
  | "readonly"
  | "public"
  | `grant:${string}`;

export interface RuntimeEvalAction {
  id?: string;
  tool: string;
  principal?: RuntimeEvalPrincipal;
  input?: Record<string, unknown>;
  expect_status?: number;
  save_grant_as?: string;
}

export interface RuntimeEvalPlan {
  schema_version?: string;
  planner?: string;
  actions: RuntimeEvalAction[];
  final_response?: {
    responded?: boolean;
    responder?: string;
    text?: string;
  };
  notes?: string;
}

export interface RuntimeEvalScenario {
  schema_version: "runtime_orchestration_eval.v1";
  id: string;
  title: string;
  description?: string;
  suite?: string;
  identity_stage?: string;
  tags?: string[];
  identity_id?: string;
  input: {
    auth: RuntimeEvalPrincipal;
    conversation_id: string;
    run_id: string;
    inbound_type: string;
    message: string;
    owner_verified?: boolean;
    runtime_capabilities?: Record<string, unknown>;
    runtime_tools?: string[];
  };
  fixture_plan?: RuntimeEvalPlan;
  expect: RuntimeEvalExpectations;
}

export interface RuntimeEvalExpectations {
  required_calls?: RuntimeEvalCallExpectation[];
  forbidden_calls?: RuntimeEvalCallExpectation[];
  required_artifacts?: string[];
  final_response?: {
    responded?: boolean;
    responder?: string;
    text_contains?: string[];
    text_excludes?: string[];
  };
}

export interface RuntimeEvalCallExpectation {
  tool: string;
  principal?: RuntimeEvalPrincipal;
  status?: number;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface RuntimeEvalActionResult {
  action_index: number;
  tool: string;
  principal: RuntimeEvalPrincipal;
  status: number;
  input: Record<string, unknown>;
  result: unknown;
}

export interface RuntimeEvalScenarioResult {
  scenario_id: string;
  title: string;
  suite: string;
  identity_stage: string;
  tags: string[];
  inbound: RuntimeEvalScenario["input"];
  provider: string;
  model: string;
  passed: boolean;
  score: number;
  failures: string[];
  plan: RuntimeEvalPlan;
  actions: RuntimeEvalActionResult[];
  artifacts: RuntimeEvalArtifactCheck[];
}

export interface RuntimeEvalArtifactCheck {
  path: string;
  exists: boolean;
}

export interface RuntimeEvalRunResult {
  summary: {
    run_id: string;
    created_at: string;
    provider: string;
    model: string;
    total: number;
    passed: number;
    failed: number;
    scenario_dir?: string;
    suite_rollups: RuntimeEvalRollup[];
    stage_rollups: RuntimeEvalRollup[];
  };
  results: RuntimeEvalScenarioResult[];
}

export interface RuntimeEvalRollup {
  key: string;
  total: number;
  passed: number;
  failed: number;
  score: number;
}

export interface RuntimeEvalPlannerProvider {
  readonly name: string;
  readonly model: string;
  plan(scenario: RuntimeEvalScenario): Promise<RuntimeEvalPlan>;
}

export interface RuntimeEvalRunOptions {
  scenarios: RuntimeEvalScenario[];
  provider: RuntimeEvalPlannerProvider;
  keepTempRoots?: boolean;
  scenarioDir?: string;
}

interface RuntimeEvalEnvironment {
  root: string;
  app: FastifyInstance;
  identityId: string;
  tokens: Map<string, string>;
}

const AUTH_ENV_KEYS = [
  "SEMFS_AUTH_TOKEN",
  "SEMFS_ADMIN_AUTH_TOKEN",
  "SEMFS_OWNER_RUNTIME_AUTH_TOKEN",
  "SEMFS_RUNTIME_AUTH_TOKEN",
  "SEMFS_READONLY_AUTH_TOKEN",
  "SEMFS_PUBLIC_AUTH_TOKEN",
  "SEMFS_PUBLIC_ACCESS",
  "SEMFS_AUTH_TOKENS",
  "SEMFS_DEFAULT_IDENTITY_ID",
  "SEMFS_IDENTITY_BACKEND",
  "SEMFS_IDENTITY_PATH",
  "SEMFS_VECTOR_STORE",
  "SEMFS_VECTOR_FILE_DIR",
] as const;

const TOOL_ROUTES: Record<string, { method: "GET" | "POST"; url: (identityId: string) => string }> = {
  semfs_get_identity_status: { method: "GET", url: (identityId) => `/v1/identities/${identityId}/status` },
  semfs_prepare_inbound: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/inbound/prepare` },
  semfs_record_runtime_capabilities: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/runtime/capabilities` },
  semfs_prepare_orchestration_run: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/runs/prepare-orchestration` },
  semfs_prepare_subagent_run: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/runs/prepare-subagent` },
  semfs_record_agent_run_event: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/runs/events` },
  semfs_record_agent_run_result: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/runs/results` },
  semfs_record_owner_context: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/context/owner` },
  semfs_record_inbound_context: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/context/inbound` },
  semfs_record_capability_gap: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/capability-gaps` },
  semfs_create_capability_proposal: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/capability-proposals` },
  semfs_link_approval_to_artifact: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/approvals/link-artifact` },
  semfs_apply_owner_identity_seed: { method: "POST", url: (identityId) => `/v1/identities/${identityId}/profile/apply-owner-seed` },
};

export class FixtureRuntimeEvalPlannerProvider implements RuntimeEvalPlannerProvider {
  readonly name = "fixture";
  readonly model = "fixture";

  async plan(scenario: RuntimeEvalScenario): Promise<RuntimeEvalPlan> {
    if (!scenario.fixture_plan) throw new Error(`Scenario ${scenario.id} does not include fixture_plan`);
    return structuredClone(scenario.fixture_plan);
  }
}

export class OpenAICompatibleRuntimeEvalPlannerProvider implements RuntimeEvalPlannerProvider {
  readonly name = "openai-compatible";

  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1"
  ) {}

  async plan(scenario: RuntimeEvalScenario): Promise<RuntimeEvalPlan> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are evaluating a SemFS runtime. Return JSON only. Produce a runtime_orchestration_plan.v1 with an actions array. Use only the listed SemFS tool names. Do not include prose outside JSON.",
          },
          {
            role: "user",
            content: JSON.stringify(publicScenarioPrompt(scenario), null, 2),
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Planner request failed: ${response.status} ${await response.text()}`);
    const body = (await response.json()) as Record<string, unknown>;
    const choices = Array.isArray(body.choices) ? body.choices : [];
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    const content = String(message?.content ?? "");
    return parsePlannerJson(content);
  }
}

export async function loadRuntimeEvalScenarios(dir: string): Promise<RuntimeEvalScenario[]> {
  const files = (await listJsonFiles(dir)).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(file, "utf8")) as RuntimeEvalScenario));
}

export async function runRuntimeOrchestrationEvals(options: RuntimeEvalRunOptions): Promise<RuntimeEvalRunResult> {
  const results: RuntimeEvalScenarioResult[] = [];
  for (const scenario of options.scenarios) {
    results.push(await runScenario(scenario, options.provider, options.keepTempRoots ?? false));
  }
  const passed = results.filter((result) => result.passed).length;
  const createdAt = new Date();
  const runId = `eval-${timestampForPath(createdAt)}`;
  return {
    summary: {
      run_id: runId,
      created_at: createdAt.toISOString(),
      provider: options.provider.name,
      model: options.provider.model,
      total: results.length,
      passed,
      failed: results.length - passed,
      scenario_dir: options.scenarioDir,
      suite_rollups: rollup(results, "suite"),
      stage_rollups: rollup(results, "identity_stage"),
    },
    results,
  };
}

export async function writeRuntimeEvalResult(result: RuntimeEvalRunResult, outPath?: string): Promise<string> {
  const target = outPath ?? defaultResultPath(result);
  const reportPath = reportPathForResult(target);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await fs.writeFile(reportPath, renderRuntimeEvalReport(result, target), "utf8");
  await updateResultIndex(result, target, reportPath);
  return target;
}

async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listJsonFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(entryPath);
  }
  return files;
}

function rollup(results: RuntimeEvalScenarioResult[], key: "suite" | "identity_stage"): RuntimeEvalRollup[] {
  const buckets = new Map<string, RuntimeEvalScenarioResult[]>();
  for (const result of results) {
    const bucket = buckets.get(result[key]) ?? [];
    bucket.push(result);
    buckets.set(result[key], bucket);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucketKey, bucketResults]) => {
      const passed = bucketResults.filter((result) => result.passed).length;
      const total = bucketResults.length;
      return {
        key: bucketKey,
        total,
        passed,
        failed: total - passed,
        score: total === 0 ? 0 : passed / total,
      };
    });
}

function defaultResultPath(result: RuntimeEvalRunResult): string {
  return path.join(
    ".evals",
    "runtime-orchestration",
    sanitizePathSegment(result.summary.provider),
    sanitizePathSegment(result.summary.model),
    `${result.summary.run_id}.json`
  );
}

async function updateResultIndex(result: RuntimeEvalRunResult, resultPath: string, reportPath: string): Promise<void> {
  const indexPath = path.join(".evals", "runtime-orchestration", "index.json");
  const existing = await readJsonObject(indexPath);
  const existingRuns = Array.isArray(existing.runs) ? existing.runs.filter(isObject) : [];
  const resultRef = path.isAbsolute(resultPath) ? path.relative(process.cwd(), resultPath) : resultPath;
  const reportRef = path.isAbsolute(reportPath) ? path.relative(process.cwd(), reportPath) : reportPath;
  const runSummary = {
    result_path: resultRef,
    report_path: reportRef,
    ...result.summary,
  };
  const runs = [runSummary, ...existingRuns.filter((run) => run.run_id !== result.summary.run_id)].slice(0, 200);
  const index = {
    schema_version: "runtime_eval_result_index.v1",
    updated_at: new Date().toISOString(),
    result_root: ".evals/runtime-orchestration",
    note: "Generated eval results are local workspace artifacts and are intentionally ignored by git.",
    runs,
    model_performance: modelPerformance(runs),
  };
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

function reportPathForResult(resultPath: string): string {
  const parsed = path.parse(resultPath);
  return path.join(parsed.dir, `${parsed.name}.md`);
}

function renderRuntimeEvalReport(result: RuntimeEvalRunResult, resultPath: string): string {
  const lines: string[] = [];
  lines.push("# Runtime Orchestration Eval Report", "");
  lines.push(`- Run: \`${result.summary.run_id}\``);
  lines.push(`- Created: \`${result.summary.created_at}\``);
  lines.push(`- Provider: \`${result.summary.provider}\``);
  lines.push(`- Model: \`${result.summary.model}\``);
  lines.push(`- Result JSON: \`${path.isAbsolute(resultPath) ? path.relative(process.cwd(), resultPath) : resultPath}\``);
  lines.push(`- Overall: ${result.summary.passed}/${result.summary.total} passed`, "");

  lines.push("## Rollups", "");
  lines.push("| Type | Key | Passed | Total | Score |");
  lines.push("| --- | --- | ---: | ---: | ---: |");
  for (const rollupEntry of result.summary.suite_rollups) {
    lines.push(`| suite | ${escapeTable(rollupEntry.key)} | ${rollupEntry.passed} | ${rollupEntry.total} | ${formatScore(rollupEntry.score)} |`);
  }
  for (const rollupEntry of result.summary.stage_rollups) {
    lines.push(`| stage | ${escapeTable(rollupEntry.key)} | ${rollupEntry.passed} | ${rollupEntry.total} | ${formatScore(rollupEntry.score)} |`);
  }

  for (const scenario of result.results) {
    lines.push("", `## ${scenario.passed ? "PASS" : "FAIL"} ${scenario.scenario_id}`, "");
    lines.push(`- Title: ${scenario.title}`);
    lines.push(`- Stage: \`${scenario.identity_stage}\``);
    lines.push(`- Tags: ${scenario.tags.map((tag) => `\`${tag}\``).join(", ") || "none"}`);
    if (scenario.failures.length) {
      lines.push(`- Failures: ${scenario.failures.map((failure) => `\`${failure}\``).join("; ")}`);
    }

    lines.push("", "### Inbound", "");
    lines.push("```json");
    lines.push(JSON.stringify(selectReviewFields(scenario.inbound), null, 2));
    lines.push("```");

    lines.push("", "### Final Response", "");
    lines.push(scenario.plan.final_response?.text?.trim() || "_No final response text was captured. The plan only declared response metadata._");

    lines.push("", "### Actions", "");
    lines.push("| # | Tool | Principal | Status | Notes |");
    lines.push("| ---: | --- | --- | ---: | --- |");
    for (const action of scenario.actions) {
      lines.push(
        `| ${action.action_index + 1} | \`${action.tool}\` | \`${action.principal}\` | ${action.status} | ${escapeTable(actionNotes(action))} |`
      );
    }

    lines.push("", "### Artifacts", "");
    if (!scenario.artifacts.length) lines.push("_No required artifacts declared._");
    for (const artifact of scenario.artifacts) {
      lines.push(`- ${artifact.exists ? "present" : "missing"}: \`${artifact.path}\``);
    }

    lines.push("", "<details><summary>Raw action inputs and results</summary>", "");
    lines.push("```json");
    lines.push(JSON.stringify(scenario.actions, null, 2));
    lines.push("```", "", "</details>");
  }

  return `${lines.join("\n")}\n`;
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function modelPerformance(runs: Record<string, unknown>[]): Array<Record<string, unknown>> {
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const run of runs) {
    const provider = String(run.provider ?? "unknown-provider");
    const model = String(run.model ?? "unknown-model");
    const key = `${provider}\n${model}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(run);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, bucket]) => {
      const [provider, model] = key.split("\n");
      const total = bucket.reduce((sum, run) => sum + numberValue(run.total), 0);
      const passed = bucket.reduce((sum, run) => sum + numberValue(run.passed), 0);
      const failed = bucket.reduce((sum, run) => sum + numberValue(run.failed), 0);
      return {
        provider,
        model,
        runs: bucket.length,
        total,
        passed,
        failed,
        score: total === 0 ? 0 : passed / total,
      };
    });
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function runScenario(
  scenario: RuntimeEvalScenario,
  provider: RuntimeEvalPlannerProvider,
  keepTempRoot: boolean
): Promise<RuntimeEvalScenarioResult> {
  const envSnapshot = snapshotEnv();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `semfs-eval-${scenario.id}-`));
  let app: FastifyInstance | null = null;
  try {
    const environment = await setupEnvironment(root, scenario);
    app = environment.app;
    const plan = await provider.plan(scenario);
    const actions: RuntimeEvalActionResult[] = [];
    for (const [index, action] of plan.actions.entries()) {
      actions.push(await executeAction(index, action, scenario, environment));
    }
    const artifacts = await checkArtifacts(root, scenario.expect.required_artifacts ?? []);
    const failures = scoreScenario(scenario, plan, actions, artifacts);
    return {
      scenario_id: scenario.id,
      title: scenario.title,
      suite: scenario.suite ?? "runtime-orchestration",
      identity_stage: scenario.identity_stage ?? "unspecified",
      tags: scenario.tags ?? [],
      inbound: scenario.input,
      provider: provider.name,
      model: provider.model,
      passed: failures.length === 0,
      score: failures.length === 0 ? 1 : 0,
      failures,
      plan,
      actions,
      artifacts,
    };
  } finally {
    if (app) await app.close();
    restoreEnv(envSnapshot);
    if (!keepTempRoot) await fs.rm(root, { recursive: true, force: true });
  }
}

async function setupEnvironment(root: string, scenario: RuntimeEvalScenario): Promise<RuntimeEvalEnvironment> {
  const identityId = scenario.identity_id ?? "eval-identity";
  const tokens = new Map<string, string>([
    ["admin", "eval-admin-token"],
    ["owner_runtime", "eval-owner-runtime-token"],
    ["runtime", "eval-runtime-token"],
    ["readonly", "eval-readonly-token"],
    ["public", "eval-public-token"],
  ]);

  process.env.SEMFS_AUTH_TOKEN = "eval-default-runtime-token";
  process.env.SEMFS_ADMIN_AUTH_TOKEN = tokens.get("admin");
  process.env.SEMFS_OWNER_RUNTIME_AUTH_TOKEN = tokens.get("owner_runtime");
  process.env.SEMFS_RUNTIME_AUTH_TOKEN = tokens.get("runtime");
  process.env.SEMFS_READONLY_AUTH_TOKEN = tokens.get("readonly");
  process.env.SEMFS_PUBLIC_AUTH_TOKEN = tokens.get("public");
  process.env.SEMFS_PUBLIC_ACCESS = "false";
  delete process.env.SEMFS_AUTH_TOKENS;
  process.env.SEMFS_DEFAULT_IDENTITY_ID = identityId;
  process.env.SEMFS_IDENTITY_BACKEND = "local";
  process.env.SEMFS_IDENTITY_PATH = root;
  process.env.SEMFS_VECTOR_STORE = "memory";
  process.env.SEMFS_VECTOR_FILE_DIR = path.join(root, ".memory");

  const container = createContainer();
  await container.seedTemplates.initialize({
    identity_id: identityId,
    display_name: "Eval Identity",
    target: { backend: "local", path: root },
  });
  const app = await createApp(container, { logger: false });
  return { root, app, identityId, tokens };
}

async function executeAction(
  actionIndex: number,
  action: RuntimeEvalAction,
  scenario: RuntimeEvalScenario,
  environment: RuntimeEvalEnvironment
): Promise<RuntimeEvalActionResult> {
  const principal = action.principal ?? scenario.input.auth;
  const route = TOOL_ROUTES[action.tool];
  const input = action.input ?? {};
  if (!route) {
    return {
      action_index: actionIndex,
      tool: action.tool,
      principal,
      status: 0,
      input,
      result: { error: "unknown_tool" },
    };
  }

  const token = tokenForPrincipal(principal, environment.tokens);
  if (!token) {
    return {
      action_index: actionIndex,
      tool: action.tool,
      principal,
      status: 0,
      input,
      result: { error: "missing_principal_token" },
    };
  }

  const response = await environment.app.inject({
    method: route.method,
    url: route.url(environment.identityId),
    headers: { authorization: `Bearer ${token}` },
    payload: route.method === "POST" ? input : undefined,
  });
  const result = parseResponseBody(response.body);
  if (action.tool === "semfs_prepare_subagent_run" && action.save_grant_as && isObject(result)) {
    const grant = result.grant;
    if (isObject(grant) && typeof grant.token === "string") environment.tokens.set(`grant:${action.save_grant_as}`, grant.token);
  }
  return {
    action_index: actionIndex,
    tool: action.tool,
    principal,
    status: response.statusCode,
    input,
    result,
  };
}

function scoreScenario(
  scenario: RuntimeEvalScenario,
  plan: RuntimeEvalPlan,
  actions: RuntimeEvalActionResult[],
  artifacts: RuntimeEvalArtifactCheck[]
): string[] {
  const failures: string[] = [];
  for (const expected of scenario.expect.required_calls ?? []) {
    const match = actions.find((action) => callMatches(action, expected));
    if (!match) failures.push(`Missing required call: ${describeExpectation(expected)}`);
  }

  for (const forbidden of scenario.expect.forbidden_calls ?? []) {
    const match = actions.find((action) => callMatches(action, forbidden, { ignoreStatus: true, ignoreResult: true }));
    if (match) failures.push(`Forbidden call observed: ${describeExpectation(forbidden)}`);
  }

  for (const artifact of artifacts) {
    if (!artifact.exists) failures.push(`Missing required artifact: ${artifact.path}`);
  }

  const expectedFinal = scenario.expect.final_response;
  if (expectedFinal) {
    if (expectedFinal.responded !== undefined && plan.final_response?.responded !== expectedFinal.responded) {
      failures.push(`Expected final_response.responded=${expectedFinal.responded}`);
    }
    if (expectedFinal.responder && plan.final_response?.responder !== expectedFinal.responder) {
      failures.push(`Expected final_response.responder=${expectedFinal.responder}`);
    }
    for (const text of expectedFinal.text_contains ?? []) {
      if (!plan.final_response?.text?.includes(text)) failures.push(`Expected final_response.text to contain: ${text}`);
    }
    for (const text of expectedFinal.text_excludes ?? []) {
      if (textIncludes(plan.final_response?.text, text)) failures.push(`Expected final_response.text to avoid: ${text}`);
    }
  }
  return failures;
}

function textIncludes(text: string | undefined, fragment: string): boolean {
  return (text ?? "").toLocaleLowerCase().includes(fragment.toLocaleLowerCase());
}

function callMatches(
  action: RuntimeEvalActionResult,
  expected: RuntimeEvalCallExpectation,
  options: { ignoreStatus?: boolean; ignoreResult?: boolean } = {}
): boolean {
  if (action.tool !== expected.tool) return false;
  if (expected.principal && action.principal !== expected.principal) return false;
  if (!options.ignoreStatus && expected.status !== undefined && action.status !== expected.status) return false;
  if (expected.input && !deepContains(action.input, expected.input)) return false;
  if (!options.ignoreResult && expected.result && !deepContains(action.result, expected.result)) return false;
  return true;
}

function deepContains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every((item) => actual.some((actualItem) => deepContains(actualItem, item)));
  }
  if (isObject(expected)) {
    if (!isObject(actual)) return false;
    return Object.entries(expected).every(([key, value]) => deepContains(actual[key], value));
  }
  return Object.is(actual, expected);
}

async function checkArtifacts(root: string, artifactPaths: string[]): Promise<RuntimeEvalArtifactCheck[]> {
  return Promise.all(
    artifactPaths.map(async (artifactPath) => ({
      path: artifactPath,
      exists: await exists(path.join(root, artifactPath)),
    }))
  );
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function tokenForPrincipal(principal: RuntimeEvalPrincipal, tokens: Map<string, string>): string | undefined {
  return tokens.get(principal);
}

function parseResponseBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function selectReviewFields(input: Record<string, unknown>): Record<string, unknown> {
  const keys = ["message", "conversation_id", "run_id", "owner_verified", "runtime_capabilities", "runtime_tools"];
  const selected: Record<string, unknown> = {};
  for (const key of keys) {
    if (input[key] !== undefined) selected[key] = input[key];
  }
  return Object.keys(selected).length ? selected : input;
}

function actionNotes(action: RuntimeEvalActionResult): string {
  if (isObject(action.result)) {
    if (typeof action.result.path === "string") return action.result.path;
    if (typeof action.result.grant_record_path === "string") return action.result.grant_record_path;
    if (typeof action.result.message === "string") return action.result.message;
    if (isObject(action.result.selected) && typeof action.result.selected.route === "string") return `route=${action.result.selected.route}`;
    if (Array.isArray(action.result.allowed_subagent_types)) return `allowed=${action.result.allowed_subagent_types.join(",")}`;
  }
  return action.status >= 200 && action.status < 300 ? "ok" : "failed";
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

function parsePlannerJson(content: string): RuntimeEvalPlan {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as RuntimeEvalPlan;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Planner did not return a JSON object");
  return JSON.parse(match[0]) as RuntimeEvalPlan;
}

function publicScenarioPrompt(scenario: RuntimeEvalScenario): Record<string, unknown> {
  return {
    schema_version: scenario.schema_version,
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    suite: scenario.suite,
    identity_stage: scenario.identity_stage,
    tags: scenario.tags,
    input: scenario.input,
    available_tools: Object.keys(TOOL_ROUTES),
    output_schema: {
      schema_version: "runtime_orchestration_plan.v1",
      actions: [
        {
          tool: "SemFS tool name",
          principal: "runtime | owner_runtime | admin | readonly | public | grant:name",
          input: "JSON payload for the SemFS tool",
          save_grant_as: "optional grant alias when semfs_prepare_subagent_run succeeds",
        },
      ],
      final_response: {
        responded: true,
        responder: "parent_runtime",
        text: "The exact user-facing response the runtime would send for this inbound.",
      },
      final_response_expectations: {
        text_contains: ["required user-facing phrases"],
        text_excludes: ["internal or overly technical phrases that must not appear"],
      },
    },
  };
}

function describeExpectation(expected: RuntimeEvalCallExpectation): string {
  const bits = [expected.tool];
  if (expected.principal) bits.push(`principal=${expected.principal}`);
  if (expected.status !== undefined) bits.push(`status=${expected.status}`);
  return bits.join(" ");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "unknown";
}

function timestampForPath(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function snapshotEnv(): Map<string, string | undefined> {
  return new Map(AUTH_ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Map<string, string | undefined>): void {
  for (const key of AUTH_ENV_KEYS) {
    const value = snapshot.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function providerFromEnv(): RuntimeEvalPlannerProvider {
  const provider = process.env.SEMFS_EVAL_PROVIDER ?? "fixture";
  if (provider === "fixture") return new FixtureRuntimeEvalPlannerProvider();
  if (provider === "openai-compatible") {
    const apiKey = process.env.SEMFS_EVAL_API_KEY ?? process.env.OPENAI_API_KEY;
    const model = process.env.SEMFS_EVAL_MODEL;
    if (!apiKey) throw new Error("SEMFS_EVAL_API_KEY or OPENAI_API_KEY is required for openai-compatible evals");
    if (!model) throw new Error("SEMFS_EVAL_MODEL is required for openai-compatible evals");
    return new OpenAICompatibleRuntimeEvalPlannerProvider(model, apiKey, process.env.SEMFS_EVAL_BASE_URL);
  }
  throw new Error(`Unknown SEMFS_EVAL_PROVIDER: ${provider}`);
}

function parseArgs(argv: string[]): { scenarioDir: string; out?: string; keepTempRoots: boolean; noWrite: boolean } {
  let scenarioDir = "evals/runtime-orchestration";
  let out: string | undefined;
  let keepTempRoots = false;
  let noWrite = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--scenario-dir") scenarioDir = argv[++index] ?? scenarioDir;
    else if (arg === "--out") out = argv[++index];
    else if (arg === "--keep-temp-roots") keepTempRoots = true;
    else if (arg === "--no-write") noWrite = true;
  }
  return { scenarioDir, out, keepTempRoots, noWrite };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scenarios = await loadRuntimeEvalScenarios(args.scenarioDir);
  const result = await runRuntimeOrchestrationEvals({
    scenarios,
    provider: providerFromEnv(),
    keepTempRoots: args.keepTempRoots,
    scenarioDir: args.scenarioDir,
  });
  const resultPath = args.noWrite ? undefined : await writeRuntimeEvalResult(result, args.out);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (resultPath) {
    process.stderr.write(`Saved eval result: ${resultPath}\n`);
    process.stderr.write(`Saved eval report: ${reportPathForResult(resultPath)}\n`);
  }
  process.stdout.write(json);
  if (result.summary.failed > 0) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
