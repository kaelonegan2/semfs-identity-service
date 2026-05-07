# Runtime Ownership Verification

Role: `runtime-compatibility` security guidance.

A compatible runtime must verify ownership outside the identity repo and expose only an opaque trust assertion to agents.

## Runtime Must Provide

- External verification for owner and delegated roles.
- Runtime-private storage of verification evidence.
- Opaque trust assertions in the runtime contract.
- Expiration/revocation behavior for stale trust.
- Audit logging for approval and verification events.

## Runtime Must Not Expose

- Secrets.
- Tokens.
- Magic links or private routing details.
- Hidden verification algorithms.
- Raw verification evidence.
- Anything a repo reader could use to impersonate an owner.

## Agent Contract

Agents may read `identity_authority.owner_verified`, `verification_level`, `verification_source_class`, and refs. They must not request or infer verification secrets.
