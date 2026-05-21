# Owner Context To SemFS Operations

Role: `runtime-compatibility` and `maturation-model`.

This spec maps inbound context to SemFS operation families. It starts with owner-provided seed context, but the model is not owner-only. As an identity matures, different inbound sources may safely use some of the same families under stricter route, policy, review, and authority rules.

## Core Principle

Inbound context is not automatically identity state.

SemFS should help the runtime decide which step is safe:

1. capture useful context
2. canonicalize owner-approved identity truth
3. prepare or capture review
4. activate approved operating capability

Seed mode allows broad owner participation across all families, but only a narrow set of canonical updates exists today. Later lifecycle modes may allow non-owner, customer, internal-agent, or delegated-reviewer inbound to use selected families without granting authority over the whole identity.

## Operation Families

### Capture

Capture preserves useful context without making it authoritative.

Examples:

- summarize owner onboarding
- record safe conversation status
- draft research or knowledge notes
- record a capability gap
- upsert policy-allowed vector summaries

Current operations:

- `semfs_prepare_inbound`
- `semfs_write_safe_artifact`
- `semfs_vector_upsert`
- `semfs_create_review_packet`
- `semfs_prepare_dream`
- `semfs_write_safe_dream_outputs`

Future operations:

- `semfs_record_owner_context`
- `semfs_record_inbound_context`
- `semfs_record_research_source`
- `semfs_record_capability_gap`
- `semfs_create_capability_proposal`

Seed boundary:

Capture may happen from owner or runtime-safe internal work. Non-owner inbound may be clarified or packaged for review, but it must not mature the identity as authoritative truth.

### Canonicalize

Canonicalize promotes reviewed context into identity truth.

Examples:

- identity name and represented entity
- purpose and domain
- audience or market
- voice and judgment style
- offer catalog or operating model
- approved knowledge
- authority policy

Current operations:

- `semfs_apply_owner_identity_seed`

Future operations:

- `semfs_apply_identity_profile_update`
- `semfs_apply_voice_profile_update`
- `semfs_apply_domain_context`
- `semfs_apply_offer_catalog_update`
- `semfs_promote_knowledge_draft`
- `semfs_apply_authority_policy_update`

Seed boundary:

Canonicalization requires verified owner authority or a future explicit approval path. Runtime, public, readonly, and unverified inbound must not canonicalize identity state.

### Review

Review packages decisions, captures approvals, and records why action is blocked or allowed.

Examples:

- owner approval for identity profile changes
- approval for public answers
- review of proposed external sends
- approval or rejection of capability proposals
- authority boundary decisions

Current operations:

- `semfs_create_review_packet`
- `semfs_capture_approval`
- `semfs_authorize_agent_action`
- `semfs_validate_agent_output`

Future operations:

- `semfs_link_approval_to_artifact`
- `semfs_resolve_review_packet`
- `semfs_request_owner_decision`
- `semfs_apply_reviewed_context`

Seed boundary:

Review can be prepared for many inbound sources. Approval capture requires an owner-runtime or explicitly delegated reviewer path. Capturing an approval must not perform activation by itself.

### Activate

Activate changes what the identity can do.

Examples:

- lifecycle mode changes
- route activation
- tool activation
- specialist or agent activation
- credential binding
- payment enablement
- public publishing authority
- memory namespace activation

Current operations:

- none in seed mode

Future operations:

- `semfs_activate_capability`
- `semfs_activate_route`
- `semfs_activate_tool`
- `semfs_activate_specialist`
- `semfs_bind_credential_request`
- `semfs_activate_memory_namespace`
- `semfs_change_lifecycle_mode`

Seed boundary:

Activation is blocked. The seed may record gaps, draft inactive proposals, and capture approvals, but it must not activate tools, agents, specialists, routes, credentials, payments, publishing, or lifecycle modes.

## Inbound Source Matrix

| Inbound source | Capture | Canonicalize | Review | Activate |
| --- | --- | --- | --- | --- |
| Verified owner in seed mode | Yes | Yes, through owner-approved canonical operations | Yes | No direct activation in V1 |
| Runtime credential, not owner-verified | Yes, for safe summaries and review packets | No | Can prepare review | No |
| Public or readonly sender | Minimal public-safe context only | No | No, except safe escalation in future policy | No |
| Non-owner expected user/customer | Clarify, summarize, or package for review when policy allows | No | Can trigger review packet | No |
| Internal seed agent | Yes, within route and facet policy | No unless acting on approved owner context | Can prepare review | No |
| Delegated reviewer in future mode | Yes | Only for explicitly delegated context classes | Yes | Only if future policy grants limited activation authority |
| Mature internal agent in future mode | Yes, route-scoped | Possibly, if policy and approval chain allow | Yes | Possibly, if activation operation and approval chain allow |

## Seed Template Surface Map

| Context category | Template surfaces | Seed operation family | Current operation | Future canonical or activation operation |
| --- | --- | --- | --- | --- |
| Identity name, purpose, represented entity | `identity_state/profile/current.json`, `identity_state/status/current.json`, `identity/context/identity-brief.md`, `README.md` | Canonicalize | `semfs_apply_owner_identity_seed` | `semfs_apply_identity_profile_update` |
| Voice, tone, judgment | `identity_state/profile/current.json`, `identity/context/brand-voice.md`, agent prompt guidance over time | Canonicalize | partial through `semfs_apply_owner_identity_seed` | `semfs_apply_voice_profile_update` |
| Domain, audience, operating area | `identity/context/customer-model.md`, `identity/context/offers.md`, profile and status | Capture then canonicalize | partial through `semfs_apply_owner_identity_seed`; draft via `semfs_write_safe_artifact` | `semfs_apply_domain_context` |
| Offers, services, products, responsibilities | `identity/context/offers.md`, `identity_state/knowledge/review-queue.md` | Capture, review, canonicalize | draft via `semfs_write_safe_artifact` | `semfs_apply_offer_catalog_update` |
| Authority boundaries | `identity/rules/authority.md`, `identity_state/authority/*`, lifecycle permissions | Review then canonicalize | `semfs_create_review_packet`, `semfs_capture_approval` | `semfs_apply_authority_policy_update` |
| Knowledge and FAQ | `identity_state/knowledge/*`, `identity_state/research/*` | Capture, review, canonicalize | `semfs_write_safe_artifact`, `semfs_vector_upsert` | `semfs_promote_knowledge_draft` |
| Research findings | `identity_state/research/*`, `research-summary-drafts` | Capture | `semfs_write_safe_artifact`, `semfs_vector_upsert` | `semfs_record_research_source` |
| Capability gaps | `identity_state/capability_evolution/gaps.md`, `capability-gap-history` | Capture | `semfs_write_safe_artifact`, dream writeback | `semfs_record_capability_gap` |
| Capability proposals | `identity_state/capability_evolution/proposals/`, `capability-proposal-history` | Capture and review | `semfs_write_safe_artifact`, dream writeback, review packet | `semfs_create_capability_proposal` |
| Approval decisions | `identity_state/authority/approval-results/`, `human-review-history` | Review | `semfs_capture_approval` | `semfs_link_approval_to_artifact` |
| Memory maturation | `identity_state/memory/vector-namespaces.json`, namespace maturation map | Capture then activate | `semfs_vector_upsert` | `semfs_activate_memory_namespace`, `semfs_promote_memory_summary` |
| Routes, agents, tools, specialists | lifecycle, dispatch map, registries, prompts, capability proposals | Review then activate | blocked except draft proposals | `semfs_activate_capability`, `semfs_activate_route`, `semfs_activate_tool`, `semfs_activate_specialist` |

## Promotion States

Every context artifact should have one of these states:

- `captured`: useful but not authoritative
- `draft`: structured candidate for review
- `review_requested`: human or owner decision needed
- `approved`: decision captured, not necessarily active
- `canonical`: authoritative identity truth
- `activated`: changes runtime-operational behavior
- `superseded`: retained for history, no longer current
- `rejected`: explicitly not used

Seed mode mostly produces `captured`, `draft`, `review_requested`, and limited `canonical` profile state. It does not produce `activated` state.

## Routing Implications

The same operation family can be safe or unsafe depending on inbound posture:

- A verified owner saying "this identity is for X" can enter canonical profile update.
- A non-owner saying "this identity is for X" can enter capture or review, but not canonical update.
- A customer giving preference context can become route-scoped memory only after a mature audience and privacy policy exist.
- An internal agent detecting a missing live external lookup capability can record a capability gap, but not enable an external tool.
- A future delegated reviewer may approve a knowledge draft without being allowed to approve payments, credentials, or lifecycle changes.

## SemFS Design Requirements

Future SemFS operations should declare:

- required credential class
- allowed inbound source or trust posture
- target template surfaces
- promotion state produced
- whether owner approval is required
- whether the operation can change active runtime behavior
- validation schemas used before write
- blocked paths and side effects
- vector namespace policy
- audit artifact path

Operations that canonicalize or activate must be narrower than generic safe writes. Generic writes can preserve draft evidence; canonical operations should know exactly which identity surfaces they are allowed to update.

## Minimum Next Operations

The next high-value operations after `semfs_apply_owner_identity_seed` are:

1. `semfs_record_owner_context`: append a structured owner context artifact and optional vector summary.
2. `semfs_record_capability_gap`: write a schema-backed gap record instead of freeform gap markdown only.
3. `semfs_create_capability_proposal`: write a schema-backed inactive proposal with activation checklist.
4. `semfs_promote_knowledge_draft`: move reviewed knowledge from draft queue into canonical approved knowledge.
5. `semfs_apply_voice_profile_update`: update voice/tone surfaces without rewriting the full profile.
6. `semfs_link_approval_to_artifact`: bind approval decisions to the exact proposal, draft, or action reviewed.

These preserve the seed principle: the identity can mature with high agency and low owner burden, while authority-bearing changes stay explicit, auditable, and reversible.
