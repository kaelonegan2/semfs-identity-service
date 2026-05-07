# Payment Authorization Matrix

Role: `guidance` for payment approvals.

## Approval Types

- Estimate fee: `identity_owner` unless delegated.
- Deposit request: `identity_owner`.
- Final invoice/payment link: `identity_owner` or approved finance/admin role.
- Refund or concession: `identity_owner`.
- Payment provider credential binding: `identity_owner`.
- Failed/expired payment follow-up: `operations_admin`, unless refund/concession is involved.

## Required Review Packet Fields

- Payment purpose.
- Amount or amount source.
- Customer/conversation ref.
- Approved estimate or policy ref.
- Expiration.
- Refund/cancellation note.
- Credential alias.
- Runtime provider requirement.
- Customer-facing draft.
