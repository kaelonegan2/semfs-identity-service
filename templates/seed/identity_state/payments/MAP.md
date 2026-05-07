# Payments Map

Role: `guidance` for payment capability and compliance.

`identity_state/payments/` defines payment-required behavior, including 402-style payment handling. It does not store credentials or create live payment links.

[Namespace: payment-events | Purpose: runtime payment request and event summaries | Retrieval: elevated-trust payment review only]

[Namespace: payment-review-history | Purpose: deposit, estimate fee, refund, exception, and failed-payment reviews | Retrieval: before proposing a payment-related action]

## Read First

1. `payment-capability.md`
2. `402-payment-flow.md`
3. `payment-compliance.md`
4. `payment-authorization-matrix.md`
5. `examples/`

## Runtime Boundary

The runtime supplies payment provider integration, credential binding, payment link creation, event logging, and webhook handling. Agents may request reviewed payment actions but may not invent links.

## Route Integration

Payment remains policy/compliance plus human review only in this conformance target. There is no normal `payment_review` route in `identity_state/orchestration/dispatch-map.json`.

If payment is needed, the active operational agent prepares a review packet and sets `decision.routing.next = human_review`. Owner-authorized payment capability setup remains in the `payment_compliance_setup` evolution profile. A future payment route would require an approved route, agent, prompt, output contract, facet policy, examples, and eval fixtures before runtime use.
