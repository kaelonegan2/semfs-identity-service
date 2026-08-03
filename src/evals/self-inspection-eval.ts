#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContainer } from "../services/container.js";
import { LocalIdentityStore } from "../stores/local-store.js";
import { InspectionFindingType, InspectionReport } from "../services/inspection-service.js";

interface InspectionEvalScenario {
  schema_version: "self_inspection_eval.v1";
  id: string;
  title: string;
  description?: string;
  suite?: string;
  tags?: string[];
  identity_root: string;
  identity_id: string;
  eval_index?: string;
  expect: {
    overall_status?: Array<"ok" | "warnings" | "violations">;
    required_finding_types?: InspectionFindingType[];
    forbidden_finding_summaries?: string[];
    required_subject_refs?: string[];
    min_errors?: number;
  };
}

interface ScenarioResult {
  scenario_id: string;
  title: string;
  passed: boolean;
  failures: string[];
  report_summary: {
    overall_status: InspectionReport["overall_status"];
    counts: InspectionReport["counts"];
    finding_types: InspectionFindingType[];
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const defaultScenarioDir = path.resolve(repoRoot, "evals/self-inspection");

async function loadScenarios(dir: string): Promise<InspectionEvalScenario[]> {
  const entries = await fs.readdir(dir);
  const scenarios: InspectionEvalScenario[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".json")) continue;
    const raw = JSON.parse(await fs.readFile(path.join(dir, entry), "utf8")) as InspectionEvalScenario;
    scenarios.push(raw);
  }
  return scenarios;
}

function score(scenario: InspectionEvalScenario, report: InspectionReport): ScenarioResult {
  const failures: string[] = [];
  if (scenario.expect.overall_status && !scenario.expect.overall_status.includes(report.overall_status)) {
    failures.push(`expected overall_status in ${scenario.expect.overall_status.join("|")}, got ${report.overall_status}`);
  }
  const types = new Set(report.findings.map((finding) => finding.finding_type));
  for (const required of scenario.expect.required_finding_types ?? []) {
    if (!types.has(required)) failures.push(`missing required finding_type: ${required}`);
  }
  for (const forbidden of scenario.expect.forbidden_finding_summaries ?? []) {
    if (report.findings.some((finding) => finding.summary.includes(forbidden))) {
      failures.push(`forbidden finding summary appeared: ${forbidden}`);
    }
  }
  for (const subject of scenario.expect.required_subject_refs ?? []) {
    if (!report.findings.some((finding) => finding.subject_ref === subject)) {
      failures.push(`missing required subject_ref: ${subject}`);
    }
  }
  if (typeof scenario.expect.min_errors === "number" && report.counts.error < scenario.expect.min_errors) {
    failures.push(`expected at least ${scenario.expect.min_errors} errors, got ${report.counts.error}`);
  }
  return {
    scenario_id: scenario.id,
    title: scenario.title,
    passed: failures.length === 0,
    failures,
    report_summary: {
      overall_status: report.overall_status,
      counts: report.counts,
      finding_types: [...types],
    },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scenarioDir = argValue(args, "--dir") ?? defaultScenarioDir;
  const out = argValue(args, "--out");
  const write = !args.includes("--no-write");

  process.env.SEMFS_AUTH_TOKEN ??= "inspect-eval-token";
  process.env.SEMFS_IDENTITY_BACKEND ??= "local";
  process.env.SEMFS_DEFAULT_IDENTITY_ID ??= "inspection-eval";
  process.env.SEMFS_IDENTITY_PATH ??= path.resolve(repoRoot, "templates/seed");

  const container = createContainer();
  const scenarios = await loadScenarios(scenarioDir);
  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    const root = path.resolve(repoRoot, scenario.identity_root);
    const mount = {
      identityId: scenario.identity_id,
      store: new LocalIdentityStore(root),
    };
    const report = await container.inspection.inspect(mount, {
      include_human_markdown: false,
      eval_results_root: scenario.eval_index ? path.resolve(repoRoot, scenario.eval_index) : undefined,
    });
    results.push(score(scenario, report));
  }

  const summary = {
    schema_version: "self_inspection_eval_run.v1",
    run_id: `self-inspection-${new Date().toISOString().replaceAll(":", "").replaceAll(".", "")}`,
    created_at: new Date().toISOString(),
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    results,
  };

  const rendered = `${JSON.stringify(summary, null, 2)}\n`;
  if (out) {
    await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await fs.writeFile(out, rendered, "utf8");
  } else if (write) {
    const defaultOut = path.resolve(repoRoot, ".evals/self-inspection", `${summary.run_id}.json`);
    await fs.mkdir(path.dirname(defaultOut), { recursive: true });
    await fs.writeFile(defaultOut, rendered, "utf8");
  }
  console.log(rendered);
  if (summary.failed > 0) process.exitCode = 1;
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
