import { SemfsConfig } from "../types/core.js";

function env(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export function loadConfig(): SemfsConfig {
  const backend = (env("SEMFS_IDENTITY_BACKEND", "local") ?? "local") as "local" | "github";
  const authToken = env("SEMFS_AUTH_TOKEN", "dev-token-change-me")!;
  const embeddingsApiKey = env("SEMFS_EMBEDDINGS_API_KEY");
  const embeddingsBaseUrl = env("SEMFS_EMBEDDINGS_BASE_URL");
  const embeddingsModel = env("SEMFS_EMBEDDINGS_MODEL", "text-embedding-3-small")!;

  return {
    host: env("SEMFS_HOST", "127.0.0.1")!,
    port: Number(env("SEMFS_PORT", "8787")),
    authToken,
    defaultIdentityId: env("SEMFS_DEFAULT_IDENTITY_ID", "solo-identity-seed")!,
    backend,
    identityPath: env("SEMFS_IDENTITY_PATH"),
    githubRepo: env("SEMFS_GITHUB_REPO"),
    githubRef: env("SEMFS_GITHUB_REF", "main"),
    githubToken: env("SEMFS_GITHUB_TOKEN"),
    vectorStore: (env("SEMFS_VECTOR_STORE", "memory") ?? "memory") as "memory" | "null",
    embeddings:
      embeddingsApiKey && embeddingsBaseUrl
        ? { apiKey: embeddingsApiKey, baseUrl: embeddingsBaseUrl, model: embeddingsModel }
        : undefined,
  };
}
