# Credential Requirements

Role: `authoritative` credential requirement guidance.

Credentials may be needed for tools, but they are never stored in this repo.

## Candidate Credential Aliases

- `system_of_record_read_write`: CRM, account database, or production system-of-record integration.
- `email_send_approved`: approved outbound email send path.
- `calendar_capacity_read`: calendar or capacity lookup.
- `calendar_schedule_write`: approved schedule write path.
- `payment_provider_link_create`: runtime payment link generation.
- `public_review_site_publish`: temporary Q&A review site publishing.
- `feedback_survey_read`: survey/feedback ingest.

## Request Flow

1. Tooling architect or owner-authorized profile identifies credential need.
2. Credential request records alias, scope, tool, risk, approver, and expiration.
3. Owner or delegated role approves.
4. Runtime binds credential in secret manager.
5. Runtime exposes only alias and status to agents.

## Missing Credential Behavior

If a credential is missing, agents return `needs_tool` or `blocked_by_authority`, record a gap or credential request, and avoid side effects.
