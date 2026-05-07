# Runtime Tools Registry

Role: `authoritative` seed tool explanation.

The seed identity assumes a minimum compatible runtime provides internal tools, not production integrations.

## Baseline Internal Tools

- `repo_read`: read identity package files.
- `repo_write_proposal`: write safe drafts, proposals, and review artifacts.
- `conversation_artifact_write`: write compact current-status artifacts.
- `semfs_vector_retrieve`: retrieve allowed summaries through policy.
- `semfs_vector_upsert`: upsert safe summaries through policy.
- `facet_hydrate`: hydrate validated facets into the runtime contract.
- `structured_output_validate`: validate planner and agent outputs.
- `usage_event_emit`: emit usage records.
- `human_review_packet_create`: prepare human review packets.
- `owner_approval_capture`: capture approval or rejection.
- `capability_gap_record`: record a capability gap.
- `capability_proposal_create`: draft inactive capability proposals.

These are internal/runtime capabilities. They are not live external tools.

## Optional Tools

Optional tools may be available if enabled by the runtime and approved where needed:

- public/business research
- source quality checks
- temporary public review sites
- survey result ingest
- credential binding requests
- payment provider binding requests
- email draft preparation

## Prohibited In Seed Mode

The runtime must block live external sends, live scheduling, live payment requests, credential use, spending, automatic policy activation, and automatic activation of agents, tools, specialists, or capabilities.
