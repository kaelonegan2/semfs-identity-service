# SemFS REST API

All endpoints except `/health` require:

```text
Authorization: Bearer $SEMFS_AUTH_TOKEN
```

Core endpoints:

- `POST /v1/identities/initialize`
- `GET /v1/identities/:identity_id/manifest`
- `GET /v1/identities/:identity_id/context`
- `GET /v1/identities/:identity_id/agents`
- `GET /v1/identities/:identity_id/agents/:agent_id`
- `POST /v1/identities/:identity_id/agents/:agent_id/prepare-action`
- `POST /v1/identities/:identity_id/agents/:agent_id/authorize-action`
- `POST /v1/identities/:identity_id/agents/:agent_id/validate-output`
- `POST /v1/identities/:identity_id/dreams/prepare`
- `POST /v1/identities/:identity_id/dreams/validate`
- `POST /v1/identities/:identity_id/dreams/write-safe`

SemFS returns identity guidance and validation packets. It does not execute LLM calls.
