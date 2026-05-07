# Upsert Policy

Role: `authoritative`.

Seed upserts are safe summaries only.

Allowed:

- owner onboarding summaries
- profile/context summaries
- research plan or research summaries
- knowledge draft feedback
- capability gap history
- inactive capability proposal summaries
- human review decision summaries
- usage events
- conversation closeout summaries

Blocked:

- raw transcripts
- secrets
- credentials
- payment tokens
- unnecessary personal data
- private operational records
- unapproved policy treated as active truth

If sensitivity is unclear, route to `human_review`.
