import { Buffer } from "node:buffer";
import { IdentityStore, WriteResult } from "../types/core.js";
import { normalizeRepoPath } from "../utils/path.js";

interface GitHubContentFile {
  type: "file";
  content?: string;
  encoding?: string;
  sha: string;
}

interface GitHubContentDirEntry {
  type: "file" | "dir";
  path: string;
}

export class GitHubIdentityStore implements IdentityStore {
  readonly kind = "github" as const;
  readonly label: string;

  constructor(
    private readonly repo: string,
    private readonly ref: string,
    private readonly token: string
  ) {
    this.label = `${repo}@${ref}`;
  }

  private headers(): Record<string, string> {
    return {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${this.token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "semfs",
    };
  }

  private url(relPath: string): string {
    const normalized = normalizeRepoPath(relPath);
    return `https://api.github.com/repos/${this.repo}/contents/${encodeURIComponent(normalized).replaceAll("%2F", "/")}`;
  }

  private async fetchContent(relPath: string): Promise<GitHubContentFile | GitHubContentDirEntry[]> {
    const response = await fetch(`${this.url(relPath)}?ref=${encodeURIComponent(this.ref)}`, {
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`GitHub read failed for ${relPath}: ${response.status}`);
    }
    return (await response.json()) as GitHubContentFile | GitHubContentDirEntry[];
  }

  async readText(relPath: string): Promise<string> {
    const content = await this.fetchContent(relPath);
    if (Array.isArray(content) || content.type !== "file" || content.encoding !== "base64" || !content.content) {
      throw new Error(`GitHub path is not a UTF-8 file: ${relPath}`);
    }
    return Buffer.from(content.content.replaceAll("\n", ""), "base64").toString("utf8");
  }

  async writeText(relPath: string, content: string, message = `semfs: write ${relPath}`): Promise<WriteResult> {
    const normalized = normalizeRepoPath(relPath);
    let sha: string | undefined;
    try {
      const existing = await this.fetchContent(normalized);
      if (!Array.isArray(existing) && existing.type === "file") sha = existing.sha;
    } catch {
      sha = undefined;
    }
    const response = await fetch(this.url(normalized), {
      method: "PUT",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({
        message,
        branch: this.ref,
        content: Buffer.from(content, "utf8").toString("base64"),
        sha,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub write failed for ${normalized}: ${response.status} ${errorText.slice(0, 300)}`);
    }
    const payload = (await response.json()) as { content?: { sha?: string } };
    return { path: normalized, wrote: true, sha: payload.content?.sha };
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await this.fetchContent(relPath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(prefix = ""): Promise<string[]> {
    const files: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries: GitHubContentFile | GitHubContentDirEntry[];
      try {
        entries = await this.fetchContent(dir || ".");
      } catch {
        return;
      }
      if (!Array.isArray(entries)) {
        files.push(dir);
        return;
      }
      for (const entry of entries) {
        if (entry.type === "file") files.push(entry.path);
        if (entry.type === "dir") await walk(entry.path);
      }
    };
    await walk(prefix);
    return files;
  }
}
