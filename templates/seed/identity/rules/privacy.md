# Privacy Rules

Role: `authoritative` privacy boundary.

The seed repo must not store secrets, credentials, payment tokens, raw sensitive transcripts, unnecessary personal data, or private operating records.

Safe repo content:

- stable identity guidance
- lifecycle state
- registries
- prompt guidance
- schemas
- safe summaries
- draft plans
- inactive proposals
- review packets without secrets

Sensitive or high-volume context should live behind runtime-governed SemFS/vector references and be retrieved only as allowed summaries.

Example pattern:

`semfs://vector/solo-identity-seed/{namespace}/{record_id}`

If privacy posture is unclear, route to `human_review`.
