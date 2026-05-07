# Example: Deposit Request Review

Role: `example`.

## Review Packet

- Approval type: deposit request.
- Required role: `identity_owner`.
- Amount: pending owner-approved estimate.
- Credential alias: `payment_provider_link_create`.
- Runtime action: create payment link after approval.
- External message draft: pending review.

## Stop Rule

Do not send payment request or create payment link until approval and runtime provider binding are present.
