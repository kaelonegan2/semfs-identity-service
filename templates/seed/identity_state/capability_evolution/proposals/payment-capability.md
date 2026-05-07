# Proposed Capability: Payment Capability

Role: `proposal`.

Status: `proposed_inactive`.

## Business Benefit

Allow the business to request deposits or payments only after the owner binds a payment provider through the runtime and approves payment policy.

## Required Before Activation

- owner-approved payment policy
- runtime payment provider binding request
- credential/payment secret storage outside the repo
- compliance review
- human approval for payment requests
- evals for payment boundaries

## Runtime Support

- optional `payment_provider_binding_request`
- `human_review_packet_create`
- `owner_approval_capture`
- `usage_event_emit`

## Owner Approval Question

Payment requests are blocked in seed mode. Should I prepare a payment setup proposal for later review?

Safe default if unanswered: no payment setup or payment requests.
