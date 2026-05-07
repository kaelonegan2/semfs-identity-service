import crypto from "node:crypto";
import { IdentityMount } from "../types/core.js";
import { badRequest, forbidden } from "../utils/errors.js";
import { normalizeRepoPath } from "../utils/path.js";
import { IdentityBundle } from "./identity-loader.js";

const SAFE_PREFIXES = [
  "conversations/",
  "identity_state/capability_evolution/gaps.md",
  "identity_state/capability_evolution/proposals/",
  "identity_state/knowledge/review-queue.md",
  "identity_state/research/",
  "identity_state/authority/",
  ".semfs/vector/",
];

const BLOCKED_PREFIXES = [
  "identity_state/lifecycle/",
  "identity_state/registries/",
  "identity_state/orchestration/dispatch-map.json",
  "identity_state/security/",
  "identity_state/payments/",
  ".runtime/security/",
];

export class SafeWriter {
  assertSafePath(relPath: string): string {
    const normalized = normalizeRepoPath(relPath);
    if (BLOCKED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
      throw forbidden("V1 blocks lifecycle, registry, dispatch, security, payment, and credential writes", { path: normalized });
    }
    if (!SAFE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
      throw forbidden("Path is not allowlisted for safe SemFS writes", { path: normalized, safe_prefixes: SAFE_PREFIXES });
    }
    return normalized;
  }

  async writeSafe(mount: IdentityMount, relPath: string, content: string, message?: string): Promise<Record<string, unknown>> {
    const normalized = this.assertSafePath(relPath);
    const result = await mount.store.writeText(normalized, content, message ?? `semfs: safe write ${normalized}`);
    return { ok: true, result };
  }

  async createReviewPacket(mount: IdentityMount, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const conversationId = String(input.conversation_id ?? `review-${Date.now()}`);
    const path = `conversations/${conversationId}/artifacts/human-review-packet.md`;
    const content = `# Human Review Packet

Created: ${new Date().toISOString()}

## Summary

${String(input.summary ?? "Review requested.")}

## Decision Needed

${String(input.decision_needed ?? "Human review is required before action.")}

## Safe Default

${String(input.safe_default ?? "Do not act externally or activate capability.")}
`;
    return this.writeSafe(mount, path, content, `semfs: create review packet ${conversationId}`);
  }

  async captureApproval(mount: IdentityMount, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const decisionId = String(input.decision_id ?? crypto.randomUUID());
    const path = `identity_state/authority/approval-results/${decisionId}.json`;
    const payload = {
      schema_version: "approval_result.v1",
      decision_id: decisionId,
      captured_at: new Date().toISOString(),
      approval_status: input.approval_status ?? "recorded",
      reviewer: input.reviewer ?? "human",
      summary: input.summary ?? null,
      activation_performed: false,
      note: "SemFS V1 records approval results but does not activate capabilities.",
    };
    return this.writeSafe(mount, path, `${JSON.stringify(payload, null, 2)}\n`, `semfs: capture approval ${decisionId}`);
  }

  safeTargets(bundle: IdentityBundle): Record<string, unknown> {
    return {
      safe_prefixes: SAFE_PREFIXES,
      blocked_prefixes: BLOCKED_PREFIXES,
      facet_targets: bundle.facet_policy,
    };
  }
}
