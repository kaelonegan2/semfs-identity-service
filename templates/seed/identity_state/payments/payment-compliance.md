# Payment Compliance

Role: `guidance` for payment safety.

## Compliance Checks

- Payment provider credential is runtime-bound.
- Payment request has approved amount, purpose, payer or account context, expiration, and refund/cancellation posture.
- Customer-facing payment language is human-approved unless policy delegates it.
- No card data is collected by the agent.
- Payment events are logged by runtime.
- Failed/expired payments do not create service commitments.
- Refunds, discounts, concessions, and disputes route to owner review.

## Repo Boundary

The repo stores policy, schemas, examples, aliases, and approval records. It never stores live payment credentials, raw card data, or real payment links.
