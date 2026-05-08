import fs from "node:fs/promises";
import path from "node:path";
import { IdentityStore, WriteResult } from "../types/core.js";
import { normalizeRepoPath } from "../utils/path.js";

export class LocalIdentityStore implements IdentityStore {
  readonly kind = "local" as const;
  readonly label: string;

  constructor(private readonly root: string) {
    this.label = root;
  }

  private resolve(relPath: string): string {
    const normalized = normalizeRepoPath(relPath);
    const full = path.resolve(this.root, normalized);
    const root = path.resolve(this.root);
    if (!full.startsWith(root + path.sep) && full !== root) {
      throw new Error(`Refusing to access outside identity root: ${relPath}`);
    }
    return full;
  }

  async readText(relPath: string): Promise<string> {
    return fs.readFile(this.resolve(relPath), "utf8");
  }

  async writeText(relPath: string, content: string): Promise<WriteResult> {
    const full = this.resolve(relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const temp = `${full}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, content, "utf8");
    await fs.rename(temp, full);
    return { path: normalizeRepoPath(relPath), wrote: true };
  }

  async writeManyText(files: Array<{ path: string; content: string }>): Promise<WriteResult[]> {
    const writes = [];
    for (const file of files) {
      writes.push(await this.writeText(file.path, file.content));
    }
    return writes;
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(relPath));
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(prefix = "."): Promise<string[]> {
    const start = this.resolve(prefix === "." ? "README.md" : prefix);
    const root = prefix === "." ? this.root : start;
    const files: string[] = [];
    async function walk(dir: string): Promise<void> {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          files.push(path.relative(root, full).replaceAll(path.sep, "/"));
        }
      }
    }
    try {
      await walk(root);
    } catch {
      return [];
    }
    return files;
  }
}
