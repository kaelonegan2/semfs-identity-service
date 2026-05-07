# Minimum Runtime Execution Loop

Role: `runtime-compatibility`.

This spec defines the smallest practical loop proven by `examples/runtime-simulations/`. It is not runtime code.

## 1. Load First

The runtime loads:

1. `identity_state/lifecycle/current.json`
2. `identity_state/lifecycle/mode-permissions.json`
3. `.runtime/requirements.json`
4. `identity_state/orchestration/dispatch-map.json`
5. `identity_state/registries/agents.json`
6. `identity_state/registries/tools.json`
7. `identity_state/registries/output-contracts.json`
8. `identity_state/registries/facet-policy.json`
9. `.runtime/contracts/common-prep.schema.json`
10. `.runtime/contracts/facet-output.schema.json`

## 2. Compile `planner_input`

The runtime compiles a compact input from:

- current contract `ctx`, `msg`, prior facets, outbound placeholder, and audit notes
- lifecycle mode and readiness score
- owner verification and trust level
- active routes and dispatch map
- available tools
- allowed vector summaries, never raw vector records
- planner output contract

Missing context is rendered as `unknown`, `not_available`, `not_enabled`, or `requires_owner_approval`.

## 3. Render Prompt Guidance

The runtime renders the selected prompt with portable `contract` and `prep` placeholders. It must not inject the full repo, full prompt library, raw transcripts, credentials, payment tokens, or raw private records.

## 4. Call The Selected Agent

The planner first returns `decision.routing.next`, `orchestration.stage_plan`, and `orchestration.selected_agent`.

The runtime resolves that route in `dispatch-map.json`, then loads the selected agent prompt, allowed tools, output contract, and facet target.

## 5. Validate Output

The runtime validates:

- `decision.routing.next` is an active route
- required output contract fields are present
- emitted facet matches route `facet_target`
- tool requests are allowed for that agent
- authority limits are not violated

`runtime_orchestration_planner` is decision-only and does not emit a business facet. Usage events are runtime telemetry.

## 6. Hydrate The Contract

After validation, the runtime hydrates allowed facets into `contract.facets.*` according to `identity_state/registries/facet-policy.json`.

Forbidden hydration includes full repo contents, raw vector records, raw transcripts, credentials, payment tokens, and unapproved policy as active truth.

## 7. Write Conversation Artifacts

The runtime may write compact current-status or review artifacts when the facet policy and tool permissions allow it. It writes summaries, decisions, safe defaults, and next routes, not raw sensitive transcripts.

## 8. Upsert Vector Summaries

The runtime may upsert safe summaries only to allowed namespaces such as:

- `owner-onboarding-summaries`
- `identity-profile-history`
- `research-summary-drafts`
- `knowledge-draft-feedback`
- `capability-gap-history`
- `capability-proposal-history`
- `human-review-history`
- `conversation-summaries`

Inactive future namespaces such as `audience-memory` and `preference-memory` remain blocked in seed mode.

## 9. Determine Next Route

The runtime follows `decision.routing.next`.

Common seed transitions:

- verified owner setup -> `owner_onboarding`
- owner facts -> `context_collect`
- researchable gaps -> `research_plan`
- draftable knowledge -> `knowledge_draft`
- missing capability -> `capability_gap`
- inactive proposal -> `capability_proposal`
- authority/risk/non-owner business action -> `human_review`
- spam, completed work, or no safe action -> `stop`

## 10. Enforce Owner And Non-Owner Boundaries

Verified owner input may mature the identity through safe internal drafting, research planning, gap records, proposals, and review packets.

Non-owner input may create a review packet or safe closeout, but it must not mature the identity, activate capability, bind credentials, approve tools, change policy, send externally, quote, schedule, request payment, or publish.

Owner approval capture records a decision. Activation still requires a separate approved capability path, registry updates, prompt/contract/eval coverage, and runtime support.
