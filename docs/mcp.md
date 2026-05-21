# MCP Usage

SemFS ships an MCP stdio server:

```bash
pnpm mcp
```

The HTTP service also exposes stateless MCP Streamable HTTP at:

```text
POST /mcp
Authorization: Bearer $SEMFS_AUTH_TOKEN
```

Use the HTTP endpoint for hosted deployments such as Render.

MCP tools are exposed according to the credential used to connect. For example, a runtime token can read identity state and prepare actions, while an admin token can also initialize an identity.

For stdio MCP, SemFS selects a configured credential in this order: `SEMFS_MCP_AUTH_TOKEN` when set, then owner runtime, runtime, then `SEMFS_AUTH_TOKEN`. It does not invent admin authority for stdio sessions.

Runtime agents should obey the `runtime_protocol` object returned by status and inbound preparation tools. For a ready identity, `semfs_get_identity_status` normally sets `response_allowed: false` and requires `semfs_prepare_inbound` as the next SemFS call for the same inbound message. Repeating status, reading the manifest, or answering the user before inbound preparation is a protocol violation unless SemFS returned an error or the runtime changed identities.

If SemFS is exposed through a host-specific wrapper tool, the wrapper does not change the protocol: the next wrapped SemFS operation must still be the required tool. User-facing responses should not contain wrapper names, call IDs, tool inputs, raw packet JSON, internal route names, or contract fields.

Important tools:

- `semfs_initialize_identity`
- `semfs_get_identity_status`
- `semfs_apply_owner_identity_seed`
- `semfs_prepare_inbound`
- `semfs_get_memory_status`
- `semfs_get_manifest`
- `semfs_get_identity_map`
- `semfs_apply_owner_identity_seed`
- `semfs_get_agent`
- `semfs_prepare_agent_action`
- `semfs_authorize_agent_action`
- `semfs_validate_agent_output`
- `semfs_prepare_dream`
- `semfs_validate_dream`
- `semfs_write_safe_dream_outputs`
- `semfs_vector_search`
- `semfs_vector_upsert`
- `semfs_write_safe_artifact`
- `semfs_create_review_packet`
- `semfs_capture_approval`
- `semfs_record_runtime_capabilities`
- `semfs_prepare_orchestration_run`
- `semfs_prepare_subagent_run`
- `semfs_record_agent_run_event`
- `semfs_record_agent_run_result`
- `semfs_record_owner_context`
- `semfs_record_inbound_context`
- `semfs_record_knowledge_draft`
- `semfs_promote_knowledge_draft`
- `semfs_apply_voice_profile_update`
- `semfs_apply_domain_context`
- `semfs_apply_offer_catalog_update`
- `semfs_record_research_source`
- `semfs_record_capability_gap`
- `semfs_create_capability_proposal`
- `semfs_link_approval_to_artifact`
- `semfs_resolve_review_packet`
- `semfs_get_budget_posture`
- `semfs_create_credential_binding_request`
- `semfs_activate_agent`
- `semfs_activate_route`

The MCP server reads the same environment variables as the REST service.
