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
- `GET /v1/identities/:identity_id/map`
- `GET /v1/identities/:identity_id/context`
- `POST /v1/identities/:identity_id/profile/apply-owner-seed`
- `POST /v1/identities/:identity_id/profile/voice`
- `POST /v1/identities/:identity_id/profile/domain`
- `POST /v1/identities/:identity_id/offers/catalog`
- `GET /v1/identities/:identity_id/agents`
- `GET /v1/identities/:identity_id/agents/:agent_id`
- `POST /v1/identities/:identity_id/agents/:agent_id/prepare-action`
- `POST /v1/identities/:identity_id/agents/:agent_id/authorize-action`
- `POST /v1/identities/:identity_id/agents/:agent_id/validate-output`
- `POST /v1/identities/:identity_id/agents/:agent_id/activate`
- `POST /v1/identities/:identity_id/routes/:route/activate`
- `POST /v1/identities/:identity_id/knowledge/drafts`
- `POST /v1/identities/:identity_id/knowledge/drafts/:draft_id/promote`
- `POST /v1/identities/:identity_id/research/sources`
- `POST /v1/identities/:identity_id/review-packets/resolve`
- `POST /v1/identities/:identity_id/governance/budget-posture`
- `POST /v1/identities/:identity_id/security/credential-binding-requests`
- `POST /v1/identities/:identity_id/vector/upsert`
- `POST /v1/identities/:identity_id/vector/search`
- `POST /v1/identities/:identity_id/dreams/prepare`
- `POST /v1/identities/:identity_id/dreams/validate`
- `POST /v1/identities/:identity_id/dreams/write-safe`

`GET /v1/identities/:identity_id/status` and `POST /v1/identities/:identity_id/inbound/prepare` return `runtime_protocol` when the credential has inbound preparation access.

For a ready identity, status normally returns:

- `runtime_protocol.phase: "status_checked"`
- `runtime_protocol.response_allowed: false`
- `runtime_protocol.next_required_call.tool: "semfs_prepare_inbound"`
- `runtime_protocol.next_allowed_semfs_tools: ["semfs_prepare_inbound"]`
- `runtime_protocol.forbidden_next_semfs_tools_for_same_inbound`, including repeated status calls

Inbound preparation then returns:

- `runtime_protocol.phase: "inbound_prepared"`
- `runtime_protocol.response_allowed: true`
- `runtime_protocol.inbound_preparation_satisfied: true`
- final response constraints that prohibit exposing tool traces, wrapper calls, raw packet JSON, internal routes, and contract fields

SemFS returns identity guidance and validation packets. It does not execute LLM calls.
