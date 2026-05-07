# Routing Preferences

Role: `guidance`.

Seed routing uses `decision.routing.next` and `identity_state/orchestration/dispatch-map.json`.

## Active Seed Preferences

- `owner_onboarding`: verified owner asks what the identity should do or how to begin.
- `context_collect`: verified owner provides business context.
- `clarify_intent`: harmless ambiguity that can be clarified without authority.
- `research_plan`: business or market research needs to be planned.
- `knowledge_draft`: FAQ, service, policy, or intake candidates can be drafted.
- `capability_gap`: useful behavior is blocked by missing capability or policy.
- `capability_proposal`: an inactive proposal should be drafted.
- `human_review`: authority, trust, pricing, scheduling, payment, external send, credential, activation, or policy risk exists.
- `stop`: spam, noise, abuse, or no safe action.

Non-owner inbound cannot mature the identity.
