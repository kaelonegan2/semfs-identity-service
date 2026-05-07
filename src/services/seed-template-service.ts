import fs from "node:fs/promises";
import path from "node:path";
import { IdentityRegistry } from "../stores/registry.js";
import { IdentityStore, WriteResult } from "../types/core.js";
import { badRequest, conflict } from "../utils/errors.js";

export interface InitializeIdentityRequest {
  identity_id?: string;
  display_name?: string;
  owner_placeholder?: string;
  template_version?: string;
  overwrite_mode?: "refuse" | "replace_seed_files";
  target?: Record<string, unknown>;
}

export class SeedTemplateService {
  private readonly templateRoot = path.resolve(process.cwd(), "templates/seed");

  constructor(private readonly registry: IdentityRegistry) {}

  async initialize(input: InitializeIdentityRequest): Promise<Record<string, unknown>> {
    const identityId = input.identity_id;
    if (!identityId) throw badRequest("identity_id is required");
    const displayName = input.display_name ?? "Initialized Solo Identity";
    const overwriteMode = input.overwrite_mode ?? "refuse";
    const store = this.registry.createStoreFromTarget(input.target);
    const templateFiles = await this.listTemplateFiles();
    const conflicts = [];
    for (const relPath of templateFiles) {
      if (await store.exists(relPath)) conflicts.push(relPath);
    }
    if (conflicts.length && overwriteMode !== "replace_seed_files") {
      throw conflict("Target already contains SemFS seed files. Pass overwrite_mode=replace_seed_files to replace them.", {
        conflicts,
      });
    }
    const writes: WriteResult[] = [];
    for (const relPath of templateFiles) {
      const source = await fs.readFile(path.join(this.templateRoot, relPath), "utf8");
      const content = this.parameterize(source, identityId, displayName, input.owner_placeholder);
      writes.push(await store.writeText(relPath, content, `semfs: initialize seed identity ${identityId}`));
    }
    return {
      identity_id: identityId,
      display_name: displayName,
      template_version: input.template_version ?? "2026-04-30.seed.normalized",
      target: store.label,
      files_written: writes.length,
      writes,
      next_recommended_route: "owner_onboarding",
    };
  }

  private parameterize(source: string, identityId: string, displayName: string, ownerPlaceholder?: string): string {
    return source
      .replaceAll("solo-identity-seed", identityId)
      .replaceAll("Initialized Solo Identity", displayName)
      .replaceAll("owner role exists", ownerPlaceholder ? `owner role exists (${ownerPlaceholder})` : "owner role exists");
  }

  private async listTemplateFiles(): Promise<string[]> {
    const files: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === ".DS_Store") continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(this.templateRoot, full).replaceAll(path.sep, "/");
        if (entry.isDirectory()) await walk(full);
        else files.push(rel);
      }
    };
    await walk(this.templateRoot);
    return files.sort();
  }
}
