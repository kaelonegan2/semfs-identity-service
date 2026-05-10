import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FixtureRuntimeEvalPlannerProvider,
  loadRuntimeEvalScenarios,
  runRuntimeOrchestrationEvals,
} from "../src/evals/runtime-orchestration-eval.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("runtime orchestration evals", () => {
  it("passes fixture scenarios for runtime capability and sub-agent orchestration maps", async () => {
    const scenarios = await loadRuntimeEvalScenarios(path.join(repoRoot, "evals/runtime-orchestration"));
    const result = await runRuntimeOrchestrationEvals({
      scenarios,
      provider: new FixtureRuntimeEvalPlannerProvider(),
    });

    expect(result.summary.total).toBeGreaterThanOrEqual(4);
    expect(result.summary.failed).toBe(0);
    expect(result.results.map((entry) => entry.scenario_id).sort()).toContain("owner-turn-continuation");
  });
});
