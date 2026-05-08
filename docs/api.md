# SemFS REST API

All endpoints except `/health` require:

```text
Authorization: Bearer $SEMFS_AUTH_TOKEN
```

Credentials are scoped server-side. `SEMFS_AUTH_TOKEN` is normal runtime access. Configure `SEMFS_ADMIN_AUTH_TOKEN` for initialization/repair and `SEMFS_OWNER_RUNTIME_AUTH_TOKEN` for owner-authorized seed profile updates.

Core endpoints:

- `POST /v1/identities/initialize`
- `GET /v1/identities/:identity_id/status`
- `POST /v1/identities/:identity_id/owner/seed`
- `POST /v1/identities/:identity_id/inbound/prepare`
- `GET /v1/identities/:identity_id/memory/status`
- `GET /v1/identities/:identity_id/manifest`
- `GET /v1/identities/:identity_id/context`
- `POST /v1/identities/:identity_id/profile/apply-owner-seed`
- `GET /v1/identities/:identity_id/agents`
- `GET /v1/identities/:identity_id/agents/:agent_id`
- `POST /v1/identities/:identity_id/agents/:agent_id/prepare-action`
- `POST /v1/identities/:identity_id/agents/:agent_id/authorize-action`
- `POST /v1/identities/:identity_id/agents/:agent_id/validate-output`
- `POST /v1/identities/:identity_id/vector/upsert`
- `POST /v1/identities/:identity_id/vector/search`
- `POST /v1/identities/:identity_id/dreams/prepare`
- `POST /v1/identities/:identity_id/dreams/validate`
- `POST /v1/identities/:identity_id/dreams/write-safe`

SemFS returns identity guidance and validation packets. It does not execute LLM calls.
