# Retrieval Policy

Role: `authoritative`.

Seed retrieval is summary-only and policy-scoped.

Rules:

- Retrieve only namespaces allowed for the active route and agent.
- Prefer repo truth over vector summaries.
- Do not retrieve raw transcripts, credentials, payment details, trust evidence, or private records into prompts.
- Treat vector summaries as context, not canonical truth.
- If missing context affects external-visible accuracy or authority, route to `human_review`.
