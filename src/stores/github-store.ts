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

interface GitHubRef {
  object: { sha: string };
}

interface GitHubCommit {
  tree: { sha: string };
}

interface GitHubTree {
  sha: string;
  tree?: Array<{ path?: string; type?: string }>;
}

interface GitHubRequestError extends Error {
  status?: number;
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

  private api(path: string): string {
    return `https://api.github.com/repos/${this.repo}/${path}`;
  }

  private branchRefPath(): string {
    return `heads/${this.ref.replace(/^refs\/heads\//, "")}`;
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

  async writeManyText(files: Array<{ path: string; content: string }>, message = "semfs: bulk write"): Promise<WriteResult[]> {
    if (!files.length) return [];
    const normalizedFiles = files.map((file) => ({ path: normalizeRepoPath(file.path), content: file.content }));
    const base = await this.baseCommit();
    let tree: GitHubTree;
    try {
      tree = await this.createTree(normalizedFiles, base?.treeSha);
    } catch (error) {
      if (!base && (error as GitHubRequestError).status === 409) {
        const [first, ...rest] = normalizedFiles;
        const firstWrite = await this.writeText(first.path, first.content, message);
        if (!rest.length) return [firstWrite];
        return [firstWrite, ...(await this.writeManyText(rest, message))];
      }
      throw error;
    }
    const commit = await this.requestJson<{ sha: string }>("git/commits", {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: base?.commitSha ? [base.commitSha] : [],
      }),
    });
    if (base) {
      await this.requestJson(`git/refs/${this.branchRefPath()}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha }),
      });
    } else {
      await this.requestJson("git/refs", {
        method: "POST",
        body: JSON.stringify({ ref: `refs/${this.branchRefPath()}`, sha: commit.sha }),
      });
    }
    return normalizedFiles.map((file) => ({ path: file.path, wrote: true, sha: commit.sha }));
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
    if (!prefix) {
      try {
        const ref = await this.requestJson<GitHubRef>(`git/ref/${this.branchRefPath()}`);
        const commit = await this.requestJson<GitHubCommit>(`git/commits/${ref.object.sha}`);
        const tree = await this.requestJson<GitHubTree>(`git/trees/${commit.tree.sha}?recursive=1`);
        return (tree.tree ?? []).filter((entry) => entry.type === "blob" && entry.path).map((entry) => entry.path!);
      } catch {
        return [];
      }
    }
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

  private async requestJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(this.api(path), {
      ...init,
      headers: { ...this.headers(), "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`GitHub API request failed for ${path}: ${response.status} ${errorText.slice(0, 300)}`) as GitHubRequestError;
      error.status = response.status;
      throw error;
    }
    return (await response.json()) as T;
  }

  private async createTree(files: Array<{ path: string; content: string }>, baseTreeSha?: string): Promise<GitHubTree> {
    return this.requestJson<GitHubTree>("git/trees", {
      method: "POST",
      body: JSON.stringify({
        ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
        tree: files.map((file) => ({
          path: file.path,
          mode: "100644",
          type: "blob",
          content: file.content,
        })),
      }),
    });
  }

  private async baseCommit(): Promise<{ commitSha: string; treeSha: string } | null> {
    try {
      const ref = await this.requestJson<GitHubRef>(`git/ref/${this.branchRefPath()}`);
      const commit = await this.requestJson<GitHubCommit>(`git/commits/${ref.object.sha}`);
      return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
    } catch (error) {
      const status = (error as GitHubRequestError).status;
      if (status === 404 || status === 409) return null;
      throw error;
    }
  }
}
