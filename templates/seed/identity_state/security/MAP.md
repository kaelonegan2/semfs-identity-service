# Security Map

Role: `authoritative` security boundary map.

`identity_state/security/` defines credential requirements and secret boundaries. It does not store credentials.

[Namespace: credential-binding-events | Purpose: credential requirement and binding status summaries, never secrets | Retrieval: runtime-only or owner-authorized review]

## Read First

1. `credential-requirements.md`
2. `secret-boundaries.md`
3. `credential-request.schema.json`

## Rule

The repo may store credential aliases, scopes, approval metadata, and expiration expectations. Secrets live only in runtime/secret-manager infrastructure.
