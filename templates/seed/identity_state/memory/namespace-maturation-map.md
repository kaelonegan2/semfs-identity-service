# Namespace Maturation Map

Role: `runtime-compatibility` guidance.

Seed namespaces are not temporary mistakes. They are safe draft/setup memory surfaces that may mature into operational namespaces after owner review, policy checks, and capability activation.

The runtime should use `namespace-maturation-map.json` when carrying seed memory forward into a richer identity. It should preserve provenance and approval refs instead of silently rewriting memory.

## Common Maturation Paths

- `owner-onboarding-summaries` -> `identity-profile-history` after owner-reviewed purpose or profile decisions.
- `research-summary-drafts` -> `business-research-sources`, `market-research-sources`, or a domain-specific research namespace after source review.
- `knowledge-draft-feedback` -> `knowledge-review-feedback`, then `approved-knowledge-answers` when reviewed and approved.
- `capability-proposal-history` -> `tool-proposal-history`, `specialist-proposal-history`, or `activated-capability-decisions` when a proposal is reviewed and activated.
- `conversation-summaries` -> operational conversation or inquiry memory after audience, privacy, and route policy are approved.
- `audience-memory` and `preference-memory` -> operational customer/user preference memory only after the matured identity has an approved audience model.

## Safety Rule

Do not treat seed draft memory as authoritative mid-state truth. Copy or link only safe summaries, keep raw/private records outside the repo, and record the approval or review basis for any promoted memory.
