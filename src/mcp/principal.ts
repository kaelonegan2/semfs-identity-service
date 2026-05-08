import { SemfsContainer } from "../services/container.js";
import { AuthPrincipal } from "../types/core.js";

export function selectMcpPrincipal(container: SemfsContainer, explicitToken?: string): AuthPrincipal {
  if (explicitToken) {
    const principal = container.auth.authenticate(`Bearer ${explicitToken}`);
    if (!principal) throw new Error("SEMFS_MCP_AUTH_TOKEN does not match any configured SemFS credential");
    return principal;
  }

  const preferredIds = ["owner-runtime", "runtime", "default-runtime"];
  for (const id of preferredIds) {
    const principal = container.config.authPrincipals.find((candidate) => candidate.id === id);
    if (principal) return { id: principal.id, tokenClass: principal.tokenClass, scopes: principal.scopes };
  }

  const fallback = container.config.authPrincipals[0];
  if (fallback) return { id: fallback.id, tokenClass: fallback.tokenClass, scopes: fallback.scopes };
  return { id: "public", tokenClass: "public", scopes: [] };
}
