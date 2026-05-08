import { ADMIN_SCOPES, OWNER_RUNTIME_SCOPES, PUBLIC_SCOPES, READONLY_SCOPES, RUNTIME_SCOPES } from "../services/auth-service.js";
import { AuthPrincipal, AuthScope, SemfsConfig } from "../types/core.js";

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
    authPrincipals: loadAuthPrincipals(authToken),
    allowPublicAccess: env("SEMFS_PUBLIC_ACCESS", "false") === "true",
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

function loadAuthPrincipals(legacyAuthToken: string): AuthPrincipal[] {
  const principals: AuthPrincipal[] = [];

  addPrincipal(principals, "admin", env("SEMFS_ADMIN_AUTH_TOKEN"), "admin", ADMIN_SCOPES);
  addPrincipal(principals, "owner-runtime", env("SEMFS_OWNER_RUNTIME_AUTH_TOKEN"), "owner_runtime", OWNER_RUNTIME_SCOPES);
  addPrincipal(principals, "runtime", env("SEMFS_RUNTIME_AUTH_TOKEN"), "runtime", RUNTIME_SCOPES);
  addPrincipal(principals, "readonly", env("SEMFS_READONLY_AUTH_TOKEN"), "readonly", READONLY_SCOPES);
  addPrincipal(principals, "public-token", env("SEMFS_PUBLIC_AUTH_TOKEN"), "public", PUBLIC_SCOPES);

  principals.push({
    id: "legacy-admin",
    tokenClass: "admin",
    scopes: ADMIN_SCOPES,
    token: legacyAuthToken,
  });

  const custom = env("SEMFS_AUTH_TOKENS");
  if (custom) {
    const parsed = JSON.parse(custom) as Array<{ id?: string; token: string; token_class?: AuthPrincipal["tokenClass"]; scopes?: AuthScope[] }>;
    for (const entry of parsed) {
      principals.push({
        id: entry.id ?? `custom-${principals.length + 1}`,
        tokenClass: entry.token_class ?? "runtime",
        scopes: entry.scopes ?? RUNTIME_SCOPES,
        token: entry.token,
      });
    }
  }

  return principals;
}

function addPrincipal(
  principals: AuthPrincipal[],
  id: string,
  token: string | undefined,
  tokenClass: AuthPrincipal["tokenClass"],
  scopes: AuthScope[]
) {
  if (!token) return;
  principals.push({ id, tokenClass, scopes, token });
}
