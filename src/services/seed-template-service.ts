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
    const conflicts = await this.findConflicts(store, templateFiles);
    if (conflicts.length && overwriteMode !== "replace_seed_files") {
      throw conflict("Target already contains SemFS seed files. Pass overwrite_mode=replace_seed_files to replace them.", {
        conflicts,
      });
    }
    const files = await Promise.all(
      templateFiles.map(async (relPath) => {
        const source = await fs.readFile(path.join(this.templateRoot, relPath), "utf8");
        return { path: relPath, content: this.parameterize(source, identityId, displayName, input.owner_placeholder) };
      })
    );
    const message = `semfs: initialize seed identity ${identityId}`;
    const writes: WriteResult[] = store.writeManyText
      ? await store.writeManyText(files, message)
      : await this.writeOneAtATime(store, files, message);
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

  private async findConflicts(store: IdentityStore, templateFiles: string[]): Promise<string[]> {
    try {
      const existing = new Set(await store.listFiles(""));
      return templateFiles.filter((relPath) => existing.has(relPath));
    } catch {
      const conflicts = [];
      for (const relPath of templateFiles) {
        if (await store.exists(relPath)) conflicts.push(relPath);
      }
      return conflicts;
    }
  }

  private async writeOneAtATime(
    store: IdentityStore,
    files: Array<{ path: string; content: string }>,
    message: string
  ): Promise<WriteResult[]> {
    const writes = [];
    for (const file of files) {
      writes.push(await store.writeText(file.path, file.content, message));
    }
    return writes;
  }
}
