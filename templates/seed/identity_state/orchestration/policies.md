# Seed Orchestration Policies

Role: `guidance`.

Use only routes from `identity_state/orchestration/dispatch-map.json`.

If intent is ambiguous and harmless, route to `clarify_intent`.

If authority, trust, pricing, scheduling, payment, credential, public publishing, policy, or activation risk exists, route to `human_review`.

If inbound is spam/noise, route to `stop`.

Non-owner inbound must not mature the identity.
