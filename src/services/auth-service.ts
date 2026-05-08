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
    const tokenClass = principal.tokenClass;
    const ownerVerifiedByCredential = tokenClass === "owner_runtime";
    const ownerCapable = ownerVerifiedByCredential || tokenClass === "admin";
    return {
      principal_id: principal.id,
      token_class: tokenClass,
      runtime_authority:
        tokenClass === "admin"
          ? "admin"
          : tokenClass === "owner_runtime"
            ? "owner_runtime"
            : tokenClass === "runtime"
              ? "runtime"
              : tokenClass === "readonly"
                ? "readonly"
                : "public",
      owner_capable_credential: ownerCapable,
      owner_verified_by_credential: ownerVerifiedByCredential,
      inbound_preparation_available: this.hasScope(principal, "inbound:prepare"),
      interpretation:
        tokenClass === "admin"
          ? "Credential can administer SemFS. It is not owner verification for an inbound user unless runtime context also says so."
          : tokenClass === "owner_runtime"
            ? "Credential represents an owner-authorized runtime. Do not ask for separate owner verification unless a specific identity policy or approval step requires it."
            : tokenClass === "runtime"
              ? "Credential represents an expected trusted runtime, not owner authority."
              : tokenClass === "readonly"
                ? "Credential can inspect identity state but should not write or take authority-bearing actions."
                : "Public access: expose only public-safe behavior.",
      scopes: principal.scopes,
    };
  }

  statusResponse(status: Record<string, unknown>, principal: AuthPrincipal): Record<string, unknown> {
    const response: Record<string, unknown> = { ...status, auth: this.context(principal) };
    if (status.state === "ready" && this.hasScope(principal, "inbound:prepare")) {
      response.recommended_next = {
        tool: "semfs_prepare_inbound",
        reason:
          "The identity is ready. For a human or external inbound message, prepare a compact identity-aware runtime packet before reading the full manifest or responding.",
        args: { identity_id: status.identity_id },
      };
      response.runtime_instruction =
        "For inbound handling, call semfs_prepare_inbound next. Treat owner_runtime credentials as owner-authorized runtime context. Do not ask for separate owner verification unless a specific policy or approval step requires it.";
    }
    return response;
  }

  private redact(principal: AuthPrincipal): AuthPrincipal {
    const { token: _token, ...safe } = principal;
    return safe;
  }
}
