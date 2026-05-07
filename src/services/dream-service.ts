import crypto from "node:crypto";
import { DreamFinding, DreamRequest } from "../types/core.js";
import { badRequest, forbidden } from "../utils/errors.js";
import { IdentityBundle } from "./identity-loader.js";
import { SafeWriter } from "./safe-writer.js";
import { IdentityMount } from "../types/core.js";

const ALLOWED_SCOPES = new Set(["profile", "knowledge", "capabilities", "authority", "memory", "agents", "tools", "specialists", "skills", "all"]);
const ALLOWED_FINDINGS = new Set([
  "missing_context",
  "knowledge_candidate",
  "research_plan",
  "capability_gap",
  "inactive_proposal",
  "specialist_gap",
  "skill_gap",
  "tool_gap",
  "review_needed",
]);

export class DreamService {
  constructor(private readonly writer: SafeWriter) {}

  prepare(bundle: IdentityBundle, input: DreamRequest): Record<string, unknown> {
    const scope = input.scope ?? "all";
    if (!ALLOWED_SCOPES.has(scope)) throw badRequest("Invalid dream scope", { allowed_scopes: [...ALLOWED_SCOPES] });
    return {
      dream_id: crypto.randomUUID(),
      identity_id: bundle.identity_id,
      scope,
      goal: input.goal ?? "Evaluate safe autonomous maturation opportunities.",
      execution_boundary: "SemFS prepares this packet; outside agents perform reasoning.",
      allowed_finding_types: [...ALLOWED_FINDINGS],
      blocked_outputs: [
        "activation",
        "lifecycle change",
        "registry edit",
        "external send",
        "credential use",
        "payment request",
        "public publishing",
      ],
      refs: this.refsForScope(scope).slice(0, input.max_refs ?? 20),
      context: {
        lifecycle: bundle.lifecycle,
        readiness: bundle.readiness,
        profile: bundle.profile,
        active_routes: Object.keys((bundle.dispatch_map.routes as Record<string, unknown> | undefined) ?? {}),
        agents: bundle.agents_registry,
        tools: bundle.tools_registry,
        specialists: bundle.specialists,
        vector_namespaces: bundle.vector_namespaces,
      },
      output_contract: {
        findings: "Array<{type,title,summary,target_ref?,safe_default?,proposed_artifact?}>",
      },
    };
  }

  validate(findings: DreamFinding[]): Record<string, unknown> {
    if (!Array.isArray(findings)) throw badRequest("findings must be an array");
    const errors = [];
    for (const [index, finding] of findings.entries()) {
      if (!ALLOWED_FINDINGS.has(finding.type)) errors.push({ index, error: `unsupported finding type: ${finding.type}` });
      const text = `${finding.type} ${finding.title} ${finding.summary} ${finding.proposed_artifact ?? ""}`.toLowerCase();
      if (["activate", "credential", "payment", "publish", "external send", "registry"].some((term) => text.includes(term))) {
        errors.push({ index, error: "finding appears to request blocked activation or side effect" });
      }
    }
    if (errors.length) throw forbidden("Dream findings are not safe for V1 writeback", { errors });
    return { ok: true, findings_count: findings.length, allowed_finding_types: [...ALLOWED_FINDINGS] };
  }

  async writeSafe(mount: IdentityMount, findings: DreamFinding[]): Promise<Record<string, unknown>> {
    this.validate(findings);
    const writes = [];
    for (const finding of findings) {
      const path = this.pathForFinding(finding);
      const content = `\n## ${finding.title}\n\nRecorded: ${new Date().toISOString()}\n\nType: \`${finding.type}\`\n\n${finding.summary}\n\nSafe default: ${finding.safe_default ?? "Keep as draft or route to human review."}\n`;
      writes.push(await this.writer.writeSafe(mount, path, content, `semfs: dream write ${finding.type}`));
    }
    return { ok: true, writes };
  }

  private pathForFinding(finding: DreamFinding): string {
    if (finding.type.includes("gap")) return "identity_state/capability_evolution/gaps.md";
    if (finding.type === "inactive_proposal") return `identity_state/capability_evolution/proposals/${slug(finding.title)}.md`;
    if (finding.type === "knowledge_candidate") return "identity_state/knowledge/review-queue.md";
    if (finding.type === "research_plan") return "identity_state/research/business-research-plan.md";
    return `conversations/dream-${Date.now()}/artifacts/human-review-packet.md`;
  }

  private refsForScope(scope: string): string[] {
    const common = ["README.md", "MAP.md", "identity_state/lifecycle/current.json", "identity_state/lifecycle/readiness-score.json"];
    const byScope: Record<string, string[]> = {
      profile: ["identity_state/profile/current.json", "identity/context/identity-brief.md"],
      knowledge: ["identity_state/knowledge/review-queue.md", "identity_state/knowledge/common-questions.md", "identity_state/knowledge/common-answers.md"],
      capabilities: ["identity_state/capability_evolution/gaps.md", "identity_state/capability_evolution/MAP.md"],
      authority: ["identity_state/authority/roles.md", "identity/rules/authority.md"],
      memory: ["identity_state/memory/vector-namespaces.json", "identity_state/memory/namespace-maturation-map.json"],
      agents: ["identity_state/registries/agents.json", "identity_state/agents/active-agents.md"],
      tools: ["identity_state/registries/tools.json", "identity_state/registries/tool-aliases.json"],
      specialists: ["identity_state/registries/specialists.json"],
      skills: ["identity_state/skills/known-skills.md", "identity_state/skills/skill-gaps.md"],
      all: [],
    };
    if (scope === "all") return [...common, ...Object.values(byScope).flat()];
    return [...common, ...(byScope[scope] ?? [])];
  }
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "proposal";
}
