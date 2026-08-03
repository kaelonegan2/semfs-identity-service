import fs from "node:fs/promises";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { IdentityMount } from "../types/core.js";
import { REQUIRED_JSON_FILES, IdentityBundle, IdentityLoader } from "./identity-loader.js";
import { PolicyService } from "./policy-service.js";

export type InspectionSeverity = "error" | "warning" | "info";

export type InspectionFindingType =
  | "missing_canonical_file"
  | "invalid_ref"
  | "unmapped_file"
  | "capability_without_impl"
  | "impl_without_eval"
  | "eval_failing"
  | "eval_stale"
  | "open_task_issue"
  | "governance_contradiction"
  | "schema_violation"
  | "stale_doc"
  | "convention_uncertainty";

export interface InspectionFinding {
  finding_id: string;
  check_id: string;
  finding_type: InspectionFindingType;
  severity: InspectionSeverity;
  subject_ref?: string;
  summary: string;
  detail?: string;
  recommended_next_step?: string;
  related_refs?: string[];
}

export interface InspectionReport {
  schema_version: "identity_inspection_report.v1";
  identity_id: string;
  inspected_at: string;
  store: string;
  overall_status: "ok" | "warnings" | "violations";
  counts: { error: number; warning: number; info: number };
  checks_run: string[];
  findings: InspectionFinding[];
  uncertainties: InspectionFinding[];
  summary: string;
  human_report_markdown?: string;
}

export interface InspectOptions {
  include_human_markdown?: boolean;
  eval_results_root?: string;
  service_eval_dir?: string;
  max_unmapped_findings?: number;
}

const PATH_REF_KEYS = new Set([
  "prompt_ref",
  "mode_permissions_ref",
  "status_ref",
  "readiness_score_ref",
  "proposal_ref",
  "content_ref",
  "source_path",
  "artifact_ref",
  "registry",
  "prompt",
]);

const IGNORED_UNMAPPED_PREFIXES = [".git/", "node_modules/", ".memory/", ".evals/", ".semfs/"];
const IGNORED_UNMAPPED_FILES = new Set([".gitignore", ".DS_Store"]);

const MATURE_CAPABILITY_PHRASES = [
  "inbound lead qualification",
  "estimate packet preparation",
  "crew work packet",
  "maintenance follow-up",
  "customer reply drafting",
];

export class SelfInspectionService {
  constructor(
    private readonly loader: IdentityLoader,
    private readonly policy: PolicyService
  ) {}

  async inspect(mount: IdentityMount, options: InspectOptions = {}): Promise<InspectionReport> {
    const findings: InspectionFinding[] = [];
    const checks_run: string[] = [];
    const status = await this.loader.status(mount);
    const files = await this.safeListFiles(mount);
    const fileSet = new Set(files);

    let bundle: IdentityBundle | null = null;
    if (status.loadable) {
      bundle = await this.loader.load(mount);
    }

    checks_run.push("missing_canonical_files");
    findings.push(...(await this.checkMissingCanonicalFiles(mount, bundle, fileSet)));

    checks_run.push("convention_uncertainty");
    findings.push(...this.checkKnownUncertainties(bundle));

    if (bundle) {
      checks_run.push("invalid_refs");
      findings.push(...(await this.checkInvalidRefs(mount, bundle, fileSet)));

      checks_run.push("unmapped_files");
      findings.push(...(await this.checkUnmappedFiles(mount, bundle, files, options.max_unmapped_findings ?? 40)));

      checks_run.push("capability_without_impl");
      findings.push(...(await this.checkCapabilitiesWithoutImpl(mount, bundle, fileSet)));

      checks_run.push("impl_without_eval");
      findings.push(...(await this.checkImplWithoutEval(mount, bundle, fileSet)));

      checks_run.push("eval_health");
      findings.push(...(await this.checkEvalHealth(options)));

      checks_run.push("open_task_issues");
      findings.push(...(await this.checkOpenTaskIssues(mount, fileSet)));

      checks_run.push("governance_contradictions");
      findings.push(...this.checkGovernanceContradictions(bundle));

      checks_run.push("schema_violations");
      findings.push(...(await this.checkSchemaViolations(mount, files)));

      checks_run.push("stale_docs");
      findings.push(...(await this.checkStaleDocs(mount, bundle, fileSet)));
    } else {
      findings.push(
        this.finding({
          check_id: "loadability",
          finding_type: "missing_canonical_file",
          severity: "error",
          subject_ref: "identity_state/",
          summary: `Identity is not loadable (state=${String(status.state)}). Structural checks beyond canonical files were skipped.`,
          recommended_next_step: "Initialize or repair required canonical JSON files before full inspection.",
        })
      );
    }

    const counts = {
      error: findings.filter((f) => f.severity === "error").length,
      warning: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
    };
    const overall_status = counts.error > 0 ? "violations" : counts.warning > 0 ? "warnings" : "ok";
    const uncertainties = findings.filter((f) => f.finding_type === "convention_uncertainty");
    const report: InspectionReport = {
      schema_version: "identity_inspection_report.v1",
      identity_id: mount.identityId,
      inspected_at: new Date().toISOString(),
      store: mount.store.label,
      overall_status,
      counts,
      checks_run,
      findings,
      uncertainties,
      summary: this.summarize(overall_status, counts, findings.length, uncertainties.length),
    };
    if (options.include_human_markdown !== false) {
      report.human_report_markdown = this.toMarkdown(report);
    }
    return report;
  }

  toMarkdown(report: InspectionReport): string {
    const lines = [
      `# SemFS Identity Inspection Report`,
      ``,
      `- Identity: \`${report.identity_id}\``,
      `- Inspected at: ${report.inspected_at}`,
      `- Store: \`${report.store}\``,
      `- Overall status: **${report.overall_status}**`,
      `- Counts: ${report.counts.error} error(s), ${report.counts.warning} warning(s), ${report.counts.info} info`,
      ``,
      report.summary,
      ``,
      `## Checks Run`,
      ``,
      ...report.checks_run.map((check) => `- \`${check}\``),
      ``,
    ];

    if (!report.findings.length) {
      lines.push(`## Findings`, ``, `No findings.`, ``);
      return lines.join("\n");
    }

    lines.push(`## Findings`, ``);
    for (const finding of report.findings) {
      lines.push(`### ${finding.severity.toUpperCase()}: ${finding.summary}`);
      lines.push(``);
      lines.push(`- Finding id: \`${finding.finding_id}\``);
      lines.push(`- Type: \`${finding.finding_type}\``);
      lines.push(`- Check: \`${finding.check_id}\``);
      if (finding.subject_ref) lines.push(`- Subject: \`${finding.subject_ref}\``);
      if (finding.detail) lines.push(`- Detail: ${finding.detail}`);
      if (finding.recommended_next_step) lines.push(`- Recommended next step: ${finding.recommended_next_step}`);
      if (finding.related_refs?.length) lines.push(`- Related: ${finding.related_refs.map((ref) => `\`${ref}\``).join(", ")}`);
      lines.push(``);
    }
    return lines.join("\n");
  }

  private summarize(
    overall: InspectionReport["overall_status"],
    counts: InspectionReport["counts"],
    findingCount: number,
    uncertaintyCount: number
  ): string {
    if (overall === "ok") {
      return `Inspection completed with no warnings or violations across ${findingCount} finding slot(s).`;
    }
    return `Inspection completed with overall_status=${overall}: ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} info; ${uncertaintyCount} convention uncertainty finding(s). No automatic repairs were applied.`;
  }

  private async checkMissingCanonicalFiles(
    mount: IdentityMount,
    bundle: IdentityBundle | null,
    fileSet: Set<string>
  ): Promise<InspectionFinding[]> {
    const findings: InspectionFinding[] = [];
    const required = new Set(REQUIRED_JSON_FILES);
    const statusPaths = (bundle?.status?.canonical_paths as Record<string, string> | undefined) ?? {};
    for (const relPath of Object.values(statusPaths)) {
      if (typeof relPath === "string" && relPath.trim()) required.add(relPath);
    }

    const mapPaths = await this.pathsFromMap(mount, "MAP.md");
    for (const relPath of mapPaths) {
      if (relPath.endsWith(".json") || relPath.endsWith(".md")) required.add(relPath);
    }

    for (const relPath of [...required].sort()) {
      if (fileSet.has(relPath) || (await mount.store.exists(relPath))) continue;
      findings.push(
        this.finding({
          check_id: "missing_canonical_files",
          finding_type: "missing_canonical_file",
          severity: "error",
          subject_ref: relPath,
          summary: `Missing canonical file: ${relPath}`,
          recommended_next_step: "Restore the file from the seed template or initialize the identity.",
        })
      );
    }

    const loaderOnly = REQUIRED_JSON_FILES.filter((p) => !Object.values(statusPaths).includes(p));
    const statusOnly = Object.values(statusPaths).filter((p) => !REQUIRED_JSON_FILES.includes(p));
    if (loaderOnly.length || statusOnly.length) {
      findings.push(
        this.finding({
          check_id: "canonical_list_divergence",
          finding_type: "convention_uncertainty",
          severity: "warning",
          subject_ref: "identity_state/status/current.json#canonical_paths",
          summary: "Loader required JSON files and status.canonical_paths diverge.",
          detail: `Loader-only: ${loaderOnly.join(", ") || "(none)"}. Status-only: ${statusOnly.join(", ") || "(none)"}. Inspector checks the union and does not rewrite either list.`,
          recommended_next_step: "Document one authoritative canonical-file list without changing governance semantics in this pass.",
          related_refs: ["src/services/identity-loader.ts", "identity_state/status/current.json"],
        })
      );
    }
    return findings;
  }

  private checkKnownUncertainties(bundle: IdentityBundle | null): InspectionFinding[] {
    const findings: InspectionFinding[] = [];
    findings.push(
      this.finding({
        check_id: "gap_model_multiplicity",
        finding_type: "convention_uncertainty",
        severity: "info",
        subject_ref: "identity_state/capability_evolution/",
        summary: "Capability gaps have three representations with different status vocabularies.",
        detail: "gap-record.schema.json, prose gaps.md, and runtime capability_gap_record.v1 coexist. Inspector treats gaps.md + gaps/*.json as the open-task surface and does not merge vocabularies.",
        related_refs: [
          "identity_state/capability_evolution/gap-record.schema.json",
          "identity_state/capability_evolution/gaps.md",
        ],
      })
    );

    if (!bundle) return findings;

    const dispatch = bundle.dispatch_map;
    const hasLifecycleRoutes = Boolean((dispatch.lifecycle_modes as Record<string, unknown> | undefined)?.[String(dispatch.active_lifecycle_mode ?? "")]);
    const hasFlatRoutes = Boolean(dispatch.routes && typeof dispatch.routes === "object");
    if (hasLifecycleRoutes && hasFlatRoutes) {
      findings.push(
        this.finding({
          check_id: "dual_route_tables",
          finding_type: "convention_uncertainty",
          severity: "warning",
          subject_ref: "identity_state/orchestration/dispatch-map.json",
          summary: "dispatch-map.json contains both lifecycle_modes routes and a top-level routes table.",
          detail: "Runtime PolicyService/IdentityLoader prefer lifecycle_modes[active]. Some dream paths read the flat routes table. Inspector uses lifecycle_modes when present.",
          recommended_next_step: "Keep both readable for now; future work should designate one dispatch authority.",
        })
      );
    }
    return findings;
  }

  private async checkInvalidRefs(
    mount: IdentityMount,
    bundle: IdentityBundle,
    fileSet: Set<string>
  ): Promise<InspectionFinding[]> {
    const findings: InspectionFinding[] = [];
    const pathRefs = this.collectPathRefs(bundle);

    for (const { from, value } of pathRefs) {
      if (!looksLikeRepoPath(value)) continue;
      if (fileSet.has(value) || (await mount.store.exists(value))) continue;
      findings.push(
        this.finding({
          check_id: "invalid_refs",
          finding_type: "invalid_ref",
          severity: "error",
          subject_ref: value,
          summary: `Unresolved internal path reference: ${value}`,
          detail: `Referenced from ${from}`,
          recommended_next_step: "Add the missing file or update the reference.",
          related_refs: [from],
        })
      );
    }

    const contracts = (bundle.output_contracts.contracts as Record<string, unknown> | undefined) ?? {};
    const facets = (bundle.facet_policy.facets as Record<string, unknown> | undefined) ?? {};
    const agents = (bundle.agents_registry.agents as Record<string, unknown>[] | undefined) ?? [];
    for (const agent of agents) {
      const agentId = String(agent.id ?? "unknown");
      const contractName = String(agent.output_contract ?? "");
      if (contractName && !(contractName in contracts)) {
        findings.push(
          this.finding({
            check_id: "invalid_refs",
            finding_type: "invalid_ref",
            severity: "error",
            subject_ref: `agent:${agentId}`,
            summary: `Agent ${agentId} references missing output contract '${contractName}'`,
            related_refs: ["identity_state/registries/output-contracts.json"],
          })
        );
      }
      const facetTarget = String(agent.facet_target ?? "");
      if (facetTarget && facetTarget !== "none_runtime_decision_only" && !(facetTarget in facets)) {
        findings.push(
          this.finding({
            check_id: "invalid_refs",
            finding_type: "invalid_ref",
            severity: "error",
            subject_ref: `agent:${agentId}`,
            summary: `Agent ${agentId} references missing facet_target '${facetTarget}'`,
            related_refs: ["identity_state/registries/facet-policy.json"],
          })
        );
      }
    }

    const routes = this.policy.activeRoutes(bundle);
    for (const [routeId, route] of Object.entries(routes)) {
      const agentId = String(route.agent_id ?? "");
      if (!agentId) continue;
      try {
        this.policy.agentRecord(bundle, agentId);
      } catch {
        findings.push(
          this.finding({
            check_id: "invalid_refs",
            finding_type: "invalid_ref",
            severity: "error",
            subject_ref: `route:${routeId}`,
            summary: `Route ${routeId} references unknown agent '${agentId}'`,
            related_refs: ["identity_state/registries/agents.json"],
          })
        );
      }
      const contractName = String(route.output_contract ?? "");
      if (contractName && !(contractName in contracts)) {
        findings.push(
          this.finding({
            check_id: "invalid_refs",
            finding_type: "invalid_ref",
            severity: "error",
            subject_ref: `route:${routeId}`,
            summary: `Route ${routeId} references missing output contract '${contractName}'`,
          })
        );
      }
    }
    return findings;
  }

  private async checkUnmappedFiles(
    mount: IdentityMount,
    bundle: IdentityBundle,
    files: string[],
    maxFindings: number
  ): Promise<InspectionFinding[]> {
    const mapped = new Set<string>();
    for (const mapPath of files.filter((file) => file === "MAP.md" || file.endsWith("/MAP.md"))) {
      for (const ref of await this.pathsFromMap(mount, mapPath)) mapped.add(ref);
      mapped.add(mapPath);
    }
    for (const ref of this.collectPathRefs(bundle).map((entry) => entry.value)) {
      if (looksLikeRepoPath(ref)) mapped.add(ref);
    }
    for (const relPath of REQUIRED_JSON_FILES) mapped.add(relPath);
    const statusPaths = (bundle.status?.canonical_paths as Record<string, string> | undefined) ?? {};
    for (const relPath of Object.values(statusPaths)) mapped.add(relPath);

    // Directory presence via any mapped child counts as representation for README/MAP siblings.
    for (const mappedPath of [...mapped]) {
      const parts = mappedPath.split("/");
      while (parts.length > 1) {
        parts.pop();
        mapped.add(parts.join("/"));
      }
    }

    const unmapped = files.filter((file) => {
      if (IGNORED_UNMAPPED_FILES.has(path.posix.basename(file))) return false;
      if (IGNORED_UNMAPPED_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
      if (mapped.has(file)) return false;
      // A file is mapped if any ancestor directory is represented in MAP/registry surfaces.
      let cursor = path.posix.dirname(file);
      while (cursor && cursor !== ".") {
        if (mapped.has(cursor) || mapped.has(`${cursor}/`)) return false;
        const parent = path.posix.dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }
      return true;
    });

    const findings: InspectionFinding[] = [];
    for (const file of unmapped.slice(0, maxFindings)) {
      findings.push(
        this.finding({
          check_id: "unmapped_files",
          finding_type: "unmapped_file",
          severity: "info",
          subject_ref: file,
          summary: `File is not represented in MAP read-order lists or registry/canonical refs: ${file}`,
          recommended_next_step: "Add the path to an appropriate MAP.md or registry reference if it is part of the semantic surface.",
        })
      );
    }
    if (unmapped.length > maxFindings) {
      findings.push(
        this.finding({
          check_id: "unmapped_files",
          finding_type: "unmapped_file",
          severity: "info",
          summary: `${unmapped.length - maxFindings} additional unmapped file(s) omitted from report.`,
        })
      );
    }
    return findings;
  }

  private async checkCapabilitiesWithoutImpl(
    mount: IdentityMount,
    bundle: IdentityBundle,
    fileSet: Set<string>
  ): Promise<InspectionFinding[]> {
    const findings: InspectionFinding[] = [];
    const agents = (bundle.agents_registry.agents as Record<string, unknown>[] | undefined) ?? [];
    const tools = (bundle.tools_registry.baseline_internal_tools as Record<string, unknown>[] | undefined) ?? [];
    const toolById = new Map(tools.map((tool) => [String(tool.id), tool]));
    const routes = this.policy.activeRoutes(bundle);
    const routedAgents = new Set(Object.values(routes).map((route) => String(route.agent_id ?? "")));

    for (const agent of agents) {
      if (agent.status !== "active") continue;
      const agentId = String(agent.id ?? "unknown");
      const promptRef = String(agent.prompt_ref ?? "");
      if (!promptRef || !(fileSet.has(promptRef) || (await mount.store.exists(promptRef)))) {
        findings.push(
          this.finding({
            check_id: "capability_without_impl",
            finding_type: "capability_without_impl",
            severity: "error",
            subject_ref: `agent:${agentId}`,
            summary: `Active agent ${agentId} is missing prompt implementation at ${promptRef || "(unset)"}`,
          })
        );
      }
      for (const toolId of (agent.tools as string[] | undefined) ?? []) {
        const tool = toolById.get(toolId);
        const allowed = (tool?.allowed_agents as string[] | undefined) ?? [];
        if (!tool || !allowed.includes(agentId)) {
          findings.push(
            this.finding({
              check_id: "capability_without_impl",
              finding_type: "capability_without_impl",
              severity: "error",
              subject_ref: `agent:${agentId}`,
              summary: `Active agent ${agentId} declares tool '${toolId}' without reciprocal tools.json allowlisting`,
              related_refs: ["identity_state/registries/tools.json"],
            })
          );
        }
      }
      if (!routedAgents.has(agentId) && agentId !== "runtime_orchestration_planner" && agentId !== "identity_evolution_manager" && agentId !== "owner_review_coordinator") {
        findings.push(
          this.finding({
            check_id: "capability_without_impl",
            finding_type: "capability_without_impl",
            severity: "warning",
            subject_ref: `agent:${agentId}`,
            summary: `Active agent ${agentId} has no active dispatch route`,
            detail: "Planner/evolution/review coordinator agents may be invocation-based; other active agents usually need a route.",
          })
        );
      }
    }

    const capabilitiesDoc = await this.readOptional(mount, "identity_state/operating_model/capabilities.md");
    if (capabilitiesDoc) {
      const lower = capabilitiesDoc.toLowerCase();
      for (const phrase of MATURE_CAPABILITY_PHRASES) {
        if (lower.includes(phrase) && lower.includes("active capability surface")) {
          findings.push(
            this.finding({
              check_id: "capability_without_impl",
              finding_type: "capability_without_impl",
              severity: "warning",
              subject_ref: "identity_state/operating_model/capabilities.md",
              summary: `capabilities.md lists '${phrase}' under Active Capability Surface, but seed mode has no activated mature implementation`,
              recommended_next_step: "Treat this as documentation drift or move mature capabilities to a future/inactive section.",
              related_refs: ["identity_state/status/current.md", "identity_state/registries/agents.json"],
            })
          );
        }
      }
    }
    return findings;
  }

  private async checkImplWithoutEval(
    mount: IdentityMount,
    bundle: IdentityBundle,
    fileSet: Set<string>
  ): Promise<InspectionFinding[]> {
    const findings: InspectionFinding[] = [];
    const coveragePath = "evals/coverage.json";
    const coverage = await this.readOptionalJson(mount, coveragePath);
    const covered = new Set<string>();
    if (coverage) {
      const entries = (coverage.coverage as Array<Record<string, unknown>> | undefined) ?? [];
      for (const entry of entries) {
        covered.add(`${String(entry.subject_type)}:${String(entry.subject_id)}`);
        for (const ref of (entry.eval_refs as string[] | undefined) ?? []) {
          const clean = ref.split("#")[0];
          if (looksLikeRepoPath(clean) && !(fileSet.has(clean) || (await mount.store.exists(clean)))) {
            findings.push(
              this.finding({
                check_id: "impl_without_eval",
                finding_type: "invalid_ref",
                severity: "error",
                subject_ref: coveragePath,
                summary: `Eval coverage references missing eval surface: ${clean}`,
              })
            );
          }
        }
      }
    } else {
      findings.push(
        this.finding({
          check_id: "impl_without_eval",
          finding_type: "impl_without_eval",
          severity: "warning",
          subject_ref: coveragePath,
          summary: "evals/coverage.json is missing; impl-without-eval checks fall back to heuristic seed-eval mentions only.",
          recommended_next_step: "Add evals/coverage.json following eval_coverage.v1.",
        })
      );
    }

    const questions = (await this.readOptional(mount, "evals/questions.md")) ?? "";
    const agents = (bundle.agents_registry.agents as Record<string, unknown>[] | undefined) ?? [];
    for (const agent of agents) {
      if (agent.status !== "active") continue;
      const agentId = String(agent.id ?? "");
      const key = `agent:${agentId}`;
      const mentioned = questions.includes(agentId) || questions.toLowerCase().includes(agentId.replaceAll("_", " "));
      if (!covered.has(key) && !mentioned) {
        findings.push(
          this.finding({
            check_id: "impl_without_eval",
            finding_type: "impl_without_eval",
            severity: "warning",
            subject_ref: key,
            summary: `Active agent ${agentId} has no eval coverage entry and is not mentioned in evals/questions.md`,
            recommended_next_step: "Add an evals/coverage.json entry and/or seed eval questions for this agent.",
          })
        );
      }
    }

    for (const routeId of Object.keys(this.policy.activeRoutes(bundle))) {
      const key = `route:${routeId}`;
      const mentioned = questions.includes(routeId) || questions.toLowerCase().includes(routeId.replaceAll("_", " "));
      if (!covered.has(key) && !mentioned) {
        findings.push(
          this.finding({
            check_id: "impl_without_eval",
            finding_type: "impl_without_eval",
            severity: "warning",
            subject_ref: key,
            summary: `Active route ${routeId} has no eval coverage entry and is not mentioned in evals/questions.md`,
          })
        );
      }
    }
    return findings;
  }

  private async checkEvalHealth(options: InspectOptions): Promise<InspectionFinding[]> {
    const findings: InspectionFinding[] = [];
    const roots = [
      options.eval_results_root,
      path.resolve(process.cwd(), ".evals/runtime-orchestration/index.json"),
    ].filter(Boolean) as string[];

    let index: Record<string, unknown> | null = null;
    let indexPath: string | null = null;
    for (const candidate of roots) {
      try {
        const text = await fs.readFile(candidate, "utf8");
        index = JSON.parse(text) as Record<string, unknown>;
        indexPath = candidate;
        break;
      } catch {
        // try next
      }
    }

    if (!index || !indexPath) {
      findings.push(
        this.finding({
          check_id: "eval_health",
          finding_type: "eval_stale",
          severity: "info",
          subject_ref: ".evals/runtime-orchestration/index.json",
          summary: "No runtime eval result index found; failing/stale runtime-eval checks are informational only.",
          detail: "Seed markdown evals remain the identity-local conformance surface. Runtime orchestration results live under git-ignored .evals/.",
        })
      );
      return findings;
    }

    const runs = (index.runs as Array<Record<string, unknown>> | undefined) ?? [];
    if (!runs.length) {
      findings.push(
        this.finding({
          check_id: "eval_health",
          finding_type: "eval_stale",
          severity: "warning",
          subject_ref: indexPath,
          summary: "Eval result index exists but contains no runs.",
        })
      );
      return findings;
    }

    const latest = runs[0];
    const failed = Number(latest.failed ?? 0);
    const createdAt = String(latest.created_at ?? "");
    if (failed > 0) {
      findings.push(
        this.finding({
          check_id: "eval_health",
          finding_type: "eval_failing",
          severity: "error",
          subject_ref: indexPath,
          summary: `Latest runtime eval run has ${failed} failing scenario(s)`,
          detail: `run_id=${String(latest.run_id ?? "unknown")} created_at=${createdAt}`,
          recommended_next_step: "Inspect .evals runtime reports and fix failing scenarios before relying on this identity stage.",
        })
      );
    }

    const createdMs = Date.parse(createdAt);
    const staleAfterMs = 1000 * 60 * 60 * 24 * 30;
    if (Number.isFinite(createdMs) && Date.now() - createdMs > staleAfterMs) {
      findings.push(
        this.finding({
          check_id: "eval_health",
          finding_type: "eval_stale",
          severity: "warning",
          subject_ref: indexPath,
          summary: `Latest runtime eval run is older than 30 days (${createdAt})`,
        })
      );
    }
    return findings;
  }

  private async checkOpenTaskIssues(mount: IdentityMount, fileSet: Set<string>): Promise<InspectionFinding[]> {
    const findings: InspectionFinding[] = [];
    const gapsMd = await this.readOptional(mount, "identity_state/capability_evolution/gaps.md");
    const gapEntries = gapsMd ? parseGapMarkdown(gapsMd) : [];
    const titles = gapEntries.map((entry) => entry.title.toLowerCase());
    const seen = new Map<string, number>();
    for (const title of titles) {
      seen.set(title, (seen.get(title) ?? 0) + 1);
    }
    for (const [title, count] of seen) {
      if (count > 1) {
        findings.push(
          this.finding({
            check_id: "open_task_issues",
            finding_type: "open_task_issue",
            severity: "warning",
            subject_ref: "identity_state/capability_evolution/gaps.md",
            summary: `Duplicated open gap title appears ${count} times: ${title}`,
          })
        );
      }
    }

    const proposalFiles = [...fileSet].filter((file) => file.startsWith("identity_state/capability_evolution/proposals/") && file.endsWith(".md"));
    for (const entry of gapEntries) {
      if (/completed|done|resolved|activated/i.test(entry.status) && /gap_recorded|recorded|open|blocked/i.test(entry.status) === false) {
        findings.push(
          this.finding({
            check_id: "open_task_issues",
            finding_type: "open_task_issue",
            severity: "warning",
            subject_ref: `gap:${entry.title}`,
            summary: `Gap '${entry.title}' appears marked completed/resolved while still listed in the open gap ledger`,
            detail: `Status: ${entry.status}`,
          })
        );
      }
      if (/obsolete|retired|superseded/i.test(`${entry.title} ${entry.blocked} ${entry.status}`)) {
        findings.push(
          this.finding({
            check_id: "open_task_issues",
            finding_type: "open_task_issue",
            severity: "warning",
            subject_ref: `gap:${entry.title}`,
            summary: `Gap '${entry.title}' appears obsolete but remains open`,
          })
        );
      }
      if (/blocked/i.test(entry.status) || /blocked action/i.test(entry.blocked)) {
        // Expected for seed gaps; elevate only when a matching proposal already exists and status never advanced.
        const matchingProposal = proposalFiles.find((file) => {
          const base = path.posix.basename(file).toLowerCase();
          return entry.title.toLowerCase().split(/\s+/).some((token) => token.length > 4 && base.includes(token));
        });
        if (matchingProposal && /gap_recorded/i.test(entry.status)) {
          findings.push(
            this.finding({
              check_id: "open_task_issues",
              finding_type: "open_task_issue",
              severity: "info",
              subject_ref: `gap:${entry.title}`,
              summary: `Gap '${entry.title}' still status=gap_recorded even though a proposal file exists`,
              detail: `Proposal candidate: ${matchingProposal}. Status vocabulary mismatch may also apply.`,
              related_refs: [matchingProposal],
              recommended_next_step: "Update gap status to proposal_drafted/pending_approval when appropriate, or document why it remains gap_recorded.",
            })
          );
        }
      }
    }

    for (const file of [...fileSet].filter((entry) => entry.startsWith("identity_state/capability_evolution/gaps/") && entry.endsWith(".json"))) {
      const record = await this.readOptionalJson(mount, file);
      if (!record) continue;
      const status = String(record.status ?? record.promotion_state ?? "");
      if (/activated|resolved|completed/i.test(status)) {
        findings.push(
          this.finding({
            check_id: "open_task_issues",
            finding_type: "open_task_issue",
            severity: "warning",
            subject_ref: file,
            summary: `Gap JSON record looks completed (${status}) but remains in the gaps/ directory`,
          })
        );
      }
    }
    return findings;
  }

  private checkGovernanceContradictions(bundle: IdentityBundle): InspectionFinding[] {
    const findings: InspectionFinding[] = [];
    const activeMode = String(bundle.lifecycle.current_mode ?? bundle.dispatch_map.active_lifecycle_mode ?? "");
    const modePermissions = bundle.mode_permissions.modes as Record<string, Record<string, unknown>> | undefined;
    const mode = modePermissions?.[activeMode];
    const routesAllowed = new Set((mode?.routes_allowed as string[] | undefined) ?? []);
    const toolsAllowed = new Set([
      ...((mode?.tools_allowed as string[] | undefined) ?? []),
      ...((mode?.optional_tools_if_runtime_enabled as string[] | undefined) ?? []),
    ]);
    const activeRoutes = this.policy.activeRoutes(bundle);

    for (const routeId of Object.keys(activeRoutes)) {
      if (routesAllowed.size && !routesAllowed.has(routeId)) {
        findings.push(
          this.finding({
            check_id: "governance_contradictions",
            finding_type: "governance_contradiction",
            severity: "error",
            subject_ref: `route:${routeId}`,
            summary: `Active dispatch route '${routeId}' is not listed in mode-permissions.routes_allowed for ${activeMode}`,
            related_refs: ["identity_state/lifecycle/mode-permissions.json", "identity_state/orchestration/dispatch-map.json"],
          })
        );
      }
    }

    const agents = (bundle.agents_registry.agents as Record<string, unknown>[] | undefined) ?? [];
    for (const agent of agents) {
      if (agent.status !== "active") continue;
      for (const toolId of (agent.tools as string[] | undefined) ?? []) {
        if (toolsAllowed.size && !toolsAllowed.has(toolId)) {
          findings.push(
            this.finding({
              check_id: "governance_contradictions",
              finding_type: "governance_contradiction",
              severity: "warning",
              subject_ref: `agent:${String(agent.id)}`,
              summary: `Active agent ${String(agent.id)} uses tool '${toolId}' outside mode-permissions tools_allowed/optional set`,
              related_refs: ["identity_state/lifecycle/mode-permissions.json"],
            })
          );
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(activeRoutes, "capability_gap")) {
      findings.push(
        this.finding({
          check_id: "governance_contradictions",
          finding_type: "governance_contradiction",
          severity: "warning",
          subject_ref: "route:capability_gap",
          summary: "capability_gap is an active dispatch route, but gap-types.md says not to add decision.routing.next = capability_gap to normal dispatch.",
          detail: "Inspector reports the contradiction and does not alter governance or dispatch semantics.",
          related_refs: [
            "identity_state/capability_evolution/gap-types.md",
            "identity_state/orchestration/dispatch-map.json",
            "identity_state/lifecycle/mode-permissions.json",
          ],
          recommended_next_step: "Resolve the contradiction in a dedicated governance clarification pass.",
        })
      );
    }

    const statusMode = String(bundle.status?.mode ?? "");
    const lifecycleMode = String(bundle.lifecycle.current_mode ?? "");
    if (statusMode && lifecycleMode && statusMode !== lifecycleMode) {
      findings.push(
        this.finding({
          check_id: "governance_contradictions",
          finding_type: "governance_contradiction",
          severity: "error",
          subject_ref: "identity_state/status/current.json",
          summary: `Status mode '${statusMode}' contradicts lifecycle current_mode '${lifecycleMode}'`,
        })
      );
    }
    return findings;
  }

  private async checkSchemaViolations(mount: IdentityMount, files: string[]): Promise<InspectionFinding[]> {
    const findings: InspectionFinding[] = [];
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const schemaFiles = files.filter((file) => file.endsWith(".schema.json"));
    const schemaByDir = new Map<string, string[]>();
    for (const schemaFile of schemaFiles) {
      const dir = path.posix.dirname(schemaFile);
      const list = schemaByDir.get(dir) ?? [];
      list.push(schemaFile);
      schemaByDir.set(dir, list);
    }

    for (const file of files.filter((entry) => entry.endsWith(".json") && !entry.endsWith(".schema.json"))) {
      let value: unknown;
      try {
        value = JSON.parse(await mount.store.readText(file));
      } catch (error) {
        findings.push(
          this.finding({
            check_id: "schema_violations",
            finding_type: "schema_violation",
            severity: "error",
            subject_ref: file,
            summary: `Invalid JSON: ${file}`,
            detail: error instanceof Error ? error.message : String(error),
          })
        );
        continue;
      }

      const dir = path.posix.dirname(file);
      const adjacent = schemaByDir.get(dir) ?? [];
      const basename = path.posix.basename(file).replace(/\.json$/, "");
      const direct = adjacent.find((schema) => path.posix.basename(schema).startsWith(basename));
      const schemaPath =
        direct ??
        (file.includes("capability_evolution/gaps/")
          ? "identity_state/capability_evolution/gap-record.schema.json"
          : file === "evals/coverage.json"
            ? ".runtime/contracts/eval-coverage.schema.json"
            : undefined);

      if (!schemaPath || !(await mount.store.exists(schemaPath))) continue;
      try {
        const schema = JSON.parse(await mount.store.readText(schemaPath));
        const validate = ajv.compile(schema);
        if (!validate(value)) {
          findings.push(
            this.finding({
              check_id: "schema_violations",
              finding_type: "schema_violation",
              severity: "error",
              subject_ref: file,
              summary: `Schema violation against ${schemaPath}`,
              detail: ajv.errorsText(validate.errors),
              related_refs: [schemaPath],
            })
          );
        }
      } catch (error) {
        findings.push(
          this.finding({
            check_id: "schema_violations",
            finding_type: "schema_violation",
            severity: "warning",
            subject_ref: file,
            summary: `Could not validate ${file} against ${schemaPath}`,
            detail: error instanceof Error ? error.message : String(error),
          })
        );
      }
    }
    return findings;
  }

  private async checkStaleDocs(
    mount: IdentityMount,
    bundle: IdentityBundle,
    fileSet: Set<string>
  ): Promise<InspectionFinding[]> {
    const findings: InspectionFinding[] = [];
    for (const mapPath of [...fileSet].filter((file) => file === "MAP.md" || file.endsWith("/MAP.md"))) {
      for (const ref of await this.pathsFromMap(mount, mapPath)) {
        if (!(fileSet.has(ref) || (await mount.store.exists(ref)))) {
          findings.push(
            this.finding({
              check_id: "stale_docs",
              finding_type: "stale_doc",
              severity: "warning",
              subject_ref: mapPath,
              summary: `MAP references missing path: ${ref}`,
              related_refs: [ref],
            })
          );
        }
      }
    }

    const readme = await this.readOptional(mount, "README.md");
    if (readme) {
      const activeRoutes = Object.keys(this.policy.activeRoutes(bundle));
      for (const routeId of ["owner_onboarding", "capability_gap", "human_review", "stop"]) {
        if (activeRoutes.includes(routeId) && !readme.includes(routeId)) {
          findings.push(
            this.finding({
              check_id: "stale_docs",
              finding_type: "stale_doc",
              severity: "info",
              subject_ref: "README.md",
              summary: `README.md does not mention active seed route '${routeId}'`,
            })
          );
        }
      }
    }

    const statusMd = await this.readOptional(mount, "identity_state/status/current.md");
    const capabilitiesMd = await this.readOptional(mount, "identity_state/operating_model/capabilities.md");
    if (statusMd && /no mature external-facing workflow is active/i.test(statusMd) && capabilitiesMd && /active capability surface/i.test(capabilitiesMd)) {
      findings.push(
        this.finding({
          check_id: "stale_docs",
          finding_type: "stale_doc",
          severity: "warning",
          subject_ref: "identity_state/operating_model/capabilities.md",
          summary: "capabilities.md claims an Active Capability Surface while status/current.md says no mature external-facing workflow is active",
          related_refs: ["identity_state/status/current.md"],
        })
      );
    }
    return findings;
  }

  private collectPathRefs(bundle: IdentityBundle): Array<{ from: string; value: string }> {
    const out: Array<{ from: string; value: string }> = [];
    const walk = (value: unknown, from: string): void => {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => walk(entry, `${from}[${index}]`));
        return;
      }
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if ((PATH_REF_KEYS.has(key) || key.endsWith("_ref") || key === "eval_refs" || key === "activated_files") && typeof child === "string") {
          out.push({ from: `${from}.${key}`, value: child });
        } else if ((key === "eval_refs" || key === "activated_files") && Array.isArray(child)) {
          for (const [index, entry] of child.entries()) {
            if (typeof entry === "string") out.push({ from: `${from}.${key}[${index}]`, value: entry });
          }
        } else {
          walk(child, `${from}.${key}`);
        }
      }
    };
    walk(bundle.lifecycle, "lifecycle");
    walk(bundle.status, "status");
    walk(bundle.dispatch_map, "dispatch_map");
    walk(bundle.agents_registry, "agents_registry");
    walk(bundle.tools_registry, "tools_registry");
    walk(bundle.output_contracts, "output_contracts");
    walk(bundle.facet_policy, "facet_policy");
    walk(bundle.vector_namespaces, "vector_namespaces");
    walk(bundle.specialists, "specialists");
    return out;
  }

  private async pathsFromMap(mount: IdentityMount, mapPath: string): Promise<string[]> {
    const text = await this.readOptional(mount, mapPath);
    if (!text) return [];
    const refs = new Set<string>();
    for (const match of text.matchAll(/`([^`]+)`/g)) {
      const value = match[1].replace(/\/+$/, "");
      // Accept repo-relative files and top-level folder names used in MAP overviews.
      if (!value || value.includes("://") || value.includes(" ") || value.startsWith("/") || value.startsWith("../") || value === "..") {
        continue;
      }
      if (value.includes("/") || value.endsWith(".md") || value.endsWith(".json") || value.endsWith(".jsonl") || /^[A-Za-z0-9_.-]+$/.test(value)) {
        refs.add(value);
      }
    }
    return [...refs];
  }

  private async safeListFiles(mount: IdentityMount): Promise<string[]> {
    try {
      return (await mount.store.listFiles()).sort();
    } catch {
      try {
        return (await mount.store.listFiles(".")).sort();
      } catch {
        return [];
      }
    }
  }

  private async readOptional(mount: IdentityMount, relPath: string): Promise<string | null> {
    try {
      return await mount.store.readText(relPath);
    } catch {
      return null;
    }
  }

  private async readOptionalJson(mount: IdentityMount, relPath: string): Promise<Record<string, unknown> | null> {
    const text = await this.readOptional(mount, relPath);
    if (!text) return null;
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private finding(input: Omit<InspectionFinding, "finding_id"> & { finding_id?: string }): InspectionFinding {
    const slug = `${input.check_id}:${input.subject_ref ?? input.summary}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    return {
      finding_id: input.finding_id ?? `insp_${slug}`,
      ...input,
    };
  }
}

function looksLikeRepoPath(value: string): boolean {
  if (!value || value.includes("://") || value.includes(" ")) return false;
  if (value.startsWith("/") || value.startsWith("../") || value === "..") return false;
  return value.includes("/") || value.endsWith(".md") || value.endsWith(".json") || value.endsWith(".jsonl");
}

function parseGapMarkdown(text: string): Array<{ title: string; status: string; blocked: string }> {
  const entries: Array<{ title: string; status: string; blocked: string }> = [];
  const sections = text.split(/^###\s+/m).slice(1);
  for (const section of sections) {
    const lines = section.split("\n");
    const title = (lines[0] ?? "").trim();
    const body = lines.slice(1).join("\n");
    const status = body.match(/Status:\s*`?([^`\n]+)`?/i)?.[1]?.trim() ?? "";
    const blocked = body.match(/Blocked action:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
    if (title) entries.push({ title, status, blocked });
  }
  return entries;
}
