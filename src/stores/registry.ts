import path from "node:path";
import { SemfsConfig, IdentityMount, IdentityStore } from "../types/core.js";
import { badRequest, notFound } from "../utils/errors.js";
import { GitHubIdentityStore } from "./github-store.js";
import { LocalIdentityStore } from "./local-store.js";

export class IdentityRegistry {
  constructor(private readonly config: SemfsConfig) {}

  defaultMount(): IdentityMount {
    return {
      identityId: this.config.defaultIdentityId,
      store: this.defaultStore(),
    };
  }

  resolve(identityId: string): IdentityMount {
    if (identityId !== this.config.defaultIdentityId) {
      throw notFound(`Unknown identity: ${identityId}`, {
        configured_identity_id: this.config.defaultIdentityId,
      });
    }
    return this.defaultMount();
  }

  createStoreFromTarget(target?: Record<string, unknown>): IdentityStore {
    if (!target) return this.defaultStore();
    const backend = target.backend;
    if (backend === "local") {
      const root = target.path;
      if (typeof root !== "string") throw badRequest("Local target requires target.path");
      return new LocalIdentityStore(path.resolve(root));
    }
    if (backend === "github") {
      const repo = target.repo;
      const ref = target.ref ?? this.config.githubRef ?? "main";
      const token = target.token ?? this.config.githubToken;
      if (typeof repo !== "string" || typeof ref !== "string" || typeof token !== "string") {
        throw badRequest("GitHub target requires repo, ref, and token or SEMFS_GITHUB_TOKEN");
      }
      return new GitHubIdentityStore(repo, ref, token);
    }
    throw badRequest("target.backend must be local or github");
  }

  private defaultStore(): IdentityStore {
    if (this.config.backend === "github") {
      if (!this.config.githubRepo || !this.config.githubRef || !this.config.githubToken) {
        throw badRequest("GitHub backend requires SEMFS_GITHUB_REPO, SEMFS_GITHUB_REF, and SEMFS_GITHUB_TOKEN");
      }
      return new GitHubIdentityStore(this.config.githubRepo, this.config.githubRef, this.config.githubToken);
    }
    return new LocalIdentityStore(path.resolve(this.config.identityPath ?? "./data/identity"));
  }
}
