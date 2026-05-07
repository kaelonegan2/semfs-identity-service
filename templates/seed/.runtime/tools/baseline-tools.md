# Baseline Runtime Tools

Role: `runtime-compatibility`.

The seed identity assumes a minimum compatible Solo-style runtime. The runtime is allowed to help the identity mature, but only through safe internal capabilities.

## Minimum Internal Tools

- `repo_read`: read identity repo files.
- `repo_write_proposal`: write safe repo artifacts such as draft plans, inactive proposals, and review packets.
- `conversation_artifact_write`: write compact current-status artifacts.
- `semfs_vector_retrieve`: retrieve allowed summaries through vector policy.
- `semfs_vector_upsert`: upsert safe summaries through vector policy.
- `facet_hydrate`: hydrate validated facets into the runtime contract.
- `structured_output_validate`: validate planner and agent outputs.
- `usage_event_emit`: emit usage events.
- `human_review_packet_create`: create human review packets.
- `owner_approval_capture`: capture approval, rejection, or deferral.
- `capability_gap_record`: record a capability gap.
- `capability_proposal_create`: draft an inactive proposal.

## Optional Enhanced Tools

These may exist, but seed behavior must not depend on them:

- public web research
- source quality checks
- temporary public review site creation
- survey result ingest
- credential binding request preparation
- payment provider binding request preparation
- email draft preparation without send

## Mature Tools Not Active In Seed

Live external messaging, live scheduling, live payment, system-of-record writes, public publishing, purchasing, credential use, and specialist/tool/agent activation are blocked unless the owner approves and the runtime has binding support.
