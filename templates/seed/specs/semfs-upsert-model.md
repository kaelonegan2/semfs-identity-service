# SemFS Upsert Model

Role: `runtime-compatibility`.

Seed mode uses SemFS/vector upserts as summaries, not raw memory dumps.

## Seed Upsert Rule

A compatible runtime may upsert a vector summary only when:

- the route and agent are active in seed mode
- the namespace allows the upsert
- the content is a safe summary
- secrets, payment tokens, raw transcripts, and unnecessary private data are excluded
- sensitivity is checked
- owner approval is captured when required

## Initial Seed Upsert Examples

Owner onboarding:

- namespace: `owner-onboarding-summaries`
- content: "Owner prefers drafting identity purpose and profile assumptions first; external sends remain blocked."
- approval: not required if no sensitive content

Research summary:

- namespace: `research-summary-drafts`
- content: "Initial public research plan for audience, offerings, constraints, and common questions; no research performed yet."
- approval: not required for draft plan

Knowledge feedback:

- namespace: `knowledge-draft-feedback`
- content: "Owner approved warm tone but asked to keep all commitment language non-binding."
- approval: yes if treated as authoritative guidance

Capability gap:

- namespace: `capability-gap-history`
- content: "Intake qualification blocked until audience, offering catalog, commitment policy, and send authority are approved."
- approval: not required

## Runtime Contract Boundary

The runtime contract may carry hydrated facets and vector references. It must not carry the full repo, raw vector records, raw transcripts, private records, credentials, payment tokens, or private pricing rules.

## Conflict Rule

Authoritative repo files win over vector summaries. If vector memory conflicts with current lifecycle, dispatch, tool registry, or approval policy, route to `human_review`.
