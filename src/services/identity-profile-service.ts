import { AuthPrincipal, IdentityMount, WriteResult } from "../types/core.js";
import { forbidden } from "../utils/errors.js";
import { readJson } from "./json.js";

const UNKNOWN_DOMAIN = "unknown_pending_owner_context_or_research";

export class IdentityProfileService {
  async applyOwnerIdentitySeed(
    mount: IdentityMount,
    principal: AuthPrincipal,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (principal.tokenClass !== "owner_runtime") {
      throw forbidden("Owner identity seed updates require an owner-runtime credential", {
        token_class: principal.tokenClass,
      });
    }

    const currentProfile = await this.optionalJson(mount, "identity_state/profile/current.json");
    const currentStatus = await this.optionalJson(mount, "identity_state/status/current.json");
    const displayName = this.clean(input.display_name ?? input.represented_entity ?? currentProfile.display_name ?? "Initialized Solo Identity");
    const primaryPurpose = this.clean(
      input.primary_purpose ??
        input.profile_summary ??
        currentProfile.primary_purpose ??
        "represent and mature this owner-defined identity through safe, useful runtime behavior"
    );
    const domain = this.clean(input.business_or_function_domain ?? currentProfile.business_or_function_domain ?? UNKNOWN_DOMAIN);
    const audience = this.clean(input.audience_or_market ?? currentProfile.audience_or_market ?? UNKNOWN_DOMAIN);
    const tone = this.tone(input.tone, currentProfile.tone);
    const profileSummary = this.clean(input.profile_summary ?? `${displayName} - ${primaryPurpose}`);
    const voiceSummary = this.clean(input.voice_summary ?? tone.join(", "));
    const capturedAt = new Date().toISOString();
    const conversationId = this.clean(input.conversation_id ?? `owner-seed-${Date.now()}`);

    const profile = {
      ...currentProfile,
      profile_version: "owner_identity_seed.v1",
      identity_id: mount.identityId,
      display_name: displayName,
      type: currentProfile.type ?? "seed_ai_native_identity",
      represented_entity: this.clean(input.represented_entity ?? displayName),
      business_or_function_domain: domain,
      audience_or_market: audience,
      owner_relationship: "owner_verified_by_runtime",
      primary_purpose: primaryPurpose,
      current_context_depth: "owner_seed_profile_captured",
      tone,
      default_runtime_posture: "embody_owner_seed_profile_and_mature_safely",
      canonical_markdown: "identity_state/profile/current.md",
      identity_book: "identity/MAP.md",
      owner_seed: {
        captured_at: capturedAt,
        profile_summary: profileSummary,
        voice_summary: voiceSummary,
        owner_instruction: input.owner_instruction ?? null,
        conversation_id: conversationId,
      },
      unknowns: this.remainingUnknowns(currentProfile.unknowns),
    };

    const status = {
      ...currentStatus,
      status_version: currentStatus.status_version ?? "owner_identity_seed.v1",
      mode: currentStatus.mode ?? "seed_runtime_available",
      identity_repo_role: "owner_seeded_semfs_identity_package",
      identity: {
        ...((currentStatus.identity as Record<string, unknown> | undefined) ?? {}),
        id: mount.identityId,
        display_name: displayName,
        domain,
        context_depth: "owner_seed_profile_captured",
      },
      owner_seed: {
        captured_at: capturedAt,
        profile_summary: profileSummary,
        voice_summary: voiceSummary,
        conversation_id: conversationId,
      },
    };

    const files = [
      { path: "identity_state/profile/current.json", content: `${JSON.stringify(profile, null, 2)}\n` },
      { path: "identity_state/status/current.json", content: `${JSON.stringify(status, null, 2)}\n` },
      { path: "identity_state/profile/current.md", content: this.profileMarkdown(profile, profileSummary, voiceSummary) },
      { path: "identity/context/identity-brief.md", content: this.identityBrief(displayName, domain, audience, profileSummary, voiceSummary) },
      { path: "README.md", content: this.readme(displayName, domain, audience, profileSummary) },
      {
        path: `conversations/${conversationId}/artifacts/owner-identity-seed-update.md`,
        content: this.auditMarkdown(displayName, profileSummary, voiceSummary, input.owner_instruction, capturedAt),
      },
    ];

    const message = `semfs: apply owner identity seed ${displayName}`;
    const writes: WriteResult[] = mount.store.writeManyText
      ? await mount.store.writeManyText(files, message)
      : await this.writeOneAtATime(mount, files, message);

    return {
      ok: true,
      identity_id: mount.identityId,
      profile: {
        display_name: displayName,
        primary_purpose: primaryPurpose,
        business_or_function_domain: domain,
        audience_or_market: audience,
        current_context_depth: profile.current_context_depth,
        tone,
      },
      writes,
      approvals: {
        profile_seed_update_required: false,
        still_required_for: [
          "external_send",
          "credential_binding",
          "payment_request",
          "public_publish",
          "capability_activation",
          "lifecycle_mode_change",
        ],
      },
      next_suggested_work: [
        "deepen voice and judgment",
        "map public/business context",
        "draft sample replies",
        "record capability gaps or proposals",
      ],
    };
  }

  private async optionalJson(mount: IdentityMount, relPath: string): Promise<Record<string, unknown>> {
    try {
      return await readJson<Record<string, unknown>>(mount.store, relPath);
    } catch {
      return {};
    }
  }

  private clean(value: unknown): string {
    const cleaned = String(value ?? "").trim();
    return cleaned || "unknown_pending_owner_context_or_research";
  }

  private tone(inputTone: unknown, existingTone: unknown): string[] {
    const fromInput = Array.isArray(inputTone) ? inputTone.map((entry) => this.clean(entry)).filter(Boolean) : [];
    if (fromInput.length) return [...new Set(fromInput)].slice(0, 12);
    if (Array.isArray(existingTone) && existingTone.length) return existingTone.map((entry) => this.clean(entry)).slice(0, 12);
    return ["concise", "practical", "clear", "warm", "builder-oriented"];
  }

  private remainingUnknowns(existing: unknown): string[] {
    const unknowns = Array.isArray(existing) ? existing.map(String) : [];
    const remove = new Set(["identity_purpose", "brand/tone preference"]);
    return unknowns.filter((entry) => !remove.has(entry));
  }

  private profileMarkdown(profile: Record<string, unknown>, profileSummary: string, voiceSummary: string): string {
    return `# Current Profile

Role: \`authoritative\`.

## Identity

${profile.display_name}

${profileSummary}

## Purpose

${profile.primary_purpose}

## Domain And Audience

- Domain: ${profile.business_or_function_domain}
- Audience: ${profile.audience_or_market}

## Voice

${voiceSummary}

## Operating Posture

This is an owner-seeded identity profile. The runtime should embody this profile while continuing to mature safely through owner-approved context, research, drafts, and reviewable proposals.

External sends, credentials, payments, public publishing, capability activation, and lifecycle changes still require their own approval paths.
`;
  }

  private identityBrief(displayName: string, domain: string, audience: string, profileSummary: string, voiceSummary: string): string {
    return `# Identity Brief

Role: \`authoritative\` seed identity truth.

## Name

${displayName}

## Working Description

${profileSummary}

## Business Or Function

${domain}

## Audience Or Market

${audience}

## Voice And Judgment

${voiceSummary}

## Current Operating Posture

This identity has an owner-approved seed profile. It should use that profile as its working basis, deepen it through safe owner context and research, and avoid pretending mature external-facing capabilities are active before approval.

## Still Requires Separate Approval

- external messages
- final commitments
- payments
- credentials
- public publishing
- tool, agent, specialist, policy, or capability activation
- lifecycle mode changes
`;
  }

  private readme(displayName: string, domain: string, audience: string, profileSummary: string): string {
    return `# ${displayName}

This is a SemFS identity repository for ${displayName}.

${profileSummary}

## Current State

Lifecycle mode: \`seed_runtime_available\`.

The identity has an owner-approved seed profile and can now use that profile as its working basis. It can collect context, draft knowledge, plan research, record gaps, and prepare proposals while preserving approval boundaries.

## Domain And Audience

- Domain: ${domain}
- Audience: ${audience}

## Approval Boundaries

The identity can mature its profile and internal context from owner-approved input. External sends, credentials, payments, publishing, capability activation, and lifecycle changes require separate approval.
`;
  }

  private auditMarkdown(displayName: string, profileSummary: string, voiceSummary: string, ownerInstruction: unknown, capturedAt: string): string {
    return `# Owner Identity Seed Update

Captured: ${capturedAt}

## Identity

${displayName}

## Summary

${profileSummary}

## Voice

${voiceSummary}

## Owner Instruction

${ownerInstruction ? String(ownerInstruction) : "No additional owner instruction provided."}

## Boundary

This update changes canonical seed identity profile surfaces. It does not activate external actions, credentials, payments, publishing, capabilities, tools, agents, specialists, policies, or lifecycle mode.
`;
  }

  private async writeOneAtATime(
    mount: IdentityMount,
    files: Array<{ path: string; content: string }>,
    message: string
  ): Promise<WriteResult[]> {
    const writes = [];
    for (const file of files) {
      writes.push(await mount.store.writeText(file.path, file.content, message));
    }
    return writes;
  }
}
