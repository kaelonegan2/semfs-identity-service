import { AuthPrincipal, AuthScope } from "../types/core.js";
import { forbidden } from "../utils/errors.js";

export const ADMIN_SCOPES: AuthScope[] = [
  "identity:status",
  "identity:initialize",
  "identity:read",
  "inbound:prepare",
  "agent:read",
  "agent:prepare",
  "agent:authorize",
  "agent:validate",
  "run:prepare",
  "memory:search",
  "memory:write",
  "artifact:safe_write",
  "review:write",
  "approval:write",
  "dream:prepare",
  "dream:validate",
  "dream:write",
];

export const OWNER_RUNTIME_SCOPES: AuthScope[] = ADMIN_SCOPES.filter((scope) => scope !== "identity:initialize");

export const RUNTIME_SCOPES: AuthScope[] = [
  "identity:status",
  "identity:read",
  "inbound:prepare",
  "agent:read",
  "agent:prepare",
  "agent:authorize",
  "agent:validate",
  "run:prepare",
  "memory:search",
  "memory:write",
  "artifact:safe_write",
  "review:write",
  "dream:prepare",
  "dream:validate",
  "dream:write",
];

export const READONLY_SCOPES: AuthScope[] = ["identity:status", "identity:read", "inbound:prepare", "agent:read", "memory:search"];

export const PUBLIC_SCOPES: AuthScope[] = ["identity:status"];

export class AuthService {
  constructor(
    private readonly principals: AuthPrincipal[],
    private readonly allowPublicAccess: boolean
  ) {}

  authenticate(authorization: string | undefined): AuthPrincipal | null {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
    if (token) {
      const principal = this.principals.find((candidate) => candidate.token === token);
      if (principal) return this.redact(principal);
    }
    if (this.allowPublicAccess) {
      return { id: "public", tokenClass: "public", scopes: PUBLIC_SCOPES };
    }
    return null;
  }

  hasScope(principal: AuthPrincipal, scope: AuthScope): boolean {
    return principal.scopes.includes(scope);
  }

  requireScope(principal: AuthPrincipal, scope: AuthScope): void {
    if (!this.hasScope(principal, scope)) {
      throw forbidden("Credential does not have required SemFS scope", {
        required_scope: scope,
        principal: this.context(principal),
      });
    }
  }

  context(principal: AuthPrincipal): Record<string, unknown> {
    return {
      principal_id: principal.id,
      token_class: principal.tokenClass,
      scopes: principal.scopes,
    };
  }

  private redact(principal: AuthPrincipal): AuthPrincipal {
    const { token: _token, ...safe } = principal;
    return safe;
  }
}
