# 402 Payment Flow

Role: `guidance` for payment-required behavior.

HTTP `402 Payment Required` is used here as a semantic model for a blocked action that requires payment authorization before continuing. It does not mean the identity can process payment by itself.

Current conformance posture: payment is not a normal dispatch route. Payment-required behavior routes through `human_review` until an owner-approved payment route is explicitly registered.

## Flow

1. Agent detects work gated by payment policy.
2. Agent prepares payment-required review packet.
3. Required human role approves payment request.
4. Runtime creates payment request/link through provider.
5. Runtime records payment event.
6. Runtime resumes or stops according to payment status.

## Agent May Say

"This step requires an approved payment request before we can continue. I can prepare that for review."

## Agent Must Not

- Invent payment URLs.
- Ask for card details in chat.
- Store payment credentials.
- Mark payment received without runtime event.
- Promise scheduling or service based only on attempted payment.
