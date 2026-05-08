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

Important tools:

- `semfs_initialize_identity`
- `semfs_get_identity_status`
- `semfs_prepare_inbound`
- `semfs_get_manifest`
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

The MCP server reads the same environment variables as the REST service.
