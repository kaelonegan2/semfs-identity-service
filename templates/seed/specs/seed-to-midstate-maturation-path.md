# Seed To Mid-State Maturation Path

Role: `guidance` for deriving the runtime spec from the maturation path.

The seed repo should evolve into a richer mid-state identity through owner-minimal maturation. Evergreen Hearth is one target example, not the seed assumption.

## Starting State

The seed identity knows it exists, has an owner role, has a compatible runtime, has baseline tools, and is in `seed_runtime_available`. It does not yet know its purpose, business/domain, audience, offerings, pricing, FAQ, external workflows, credentials, payment policy, or specialists.

## Maturation Principles

- Infer and draft before asking.
- Research what can be researched.
- Ask the owner only for judgment, authority, taste, constraints, credentials, payment, risk tolerance, or approval.
- Never ask the owner to design agents, routes, tools, prompts, schemas, vector namespaces, or orchestration.
- Keep all new capabilities inactive until approved and activated.

## Step 1: Purpose And Profile

Autonomous work:

- summarize owner-provided context
- draft purpose options
- draft profile assumptions
- identify unknowns

Owner input truly required:

- confirm what the identity should help with
- confirm domain, audience, or constraints that cannot be researched safely

Avoid asking:

- how to structure the repo
- which agents to create

Runtime tools:

- `conversation_artifact_write`
- `semfs_vector_upsert`
- `human_review_packet_create`

Vector namespaces populated:

- `owner-onboarding-summaries`
- `identity-profile-history`

## Step 2: Research Plan And Research

Autonomous work:

- draft research plan
- identify public questions
- perform public research only if the runtime enables it
- mark evidence strength

Owner input truly required:

- approve treating research as business or identity policy
- correct wrong assumptions

Runtime tools:

- `repo_write_proposal`
- optional `public_web_research`
- optional `source_quality_check`

Vector namespaces populated:

- `research-summary-drafts`

## Step 3: Knowledge Drafts

Autonomous work:

- draft offering candidates
- draft FAQ candidates
- draft intake questions
- draft non-binding pricing or commitment language
- draft audience or operating-area policy

Owner input truly required:

- approve public/external-facing answers
- approve offerings, audience, operating area, and commitment posture

Runtime tools:

- `repo_write_proposal`
- `semfs_vector_upsert`
- `human_review_packet_create`

Vector namespaces populated:

- `knowledge-draft-feedback`

## Step 4: Capability Gaps

Autonomous work:

- record gaps for intake qualification, Q&A, estimate/commitment packets, payments, and private memory
- describe blocked actions and safe defaults

Owner input required:

- none to record gaps
- approval required to activate proposed capabilities

Runtime tools:

- `capability_gap_record`
- `usage_event_emit`

Vector namespaces populated:

- `capability-gap-history`

## Step 5: Capability Proposals

Autonomous work:

- draft inactive proposals
- prepare approval questions
- list runtime support and evals needed

Owner input truly required:

- approve or reject capability activation
- approve credentials, payments, public publishing, or live sends

Runtime tools:

- `capability_proposal_create`
- `human_review_packet_create`
- `owner_approval_capture`

Vector namespaces populated:

- `capability-proposal-history`
- `human-review-history`

## Step 6: Prompt, Route, And Eval Expansion

Autonomous work:

- add draft prompts for proposed capabilities
- add evals for boundaries
- add route proposals

Owner input truly required:

- approve activation, not prompt mechanics

Runtime tools:

- `repo_write_proposal`
- `structured_output_validate`

## Approval Gates

Owner approval is required for:

- external sends
- final pricing or commitments
- scheduling or capacity commitments
- payments
- credentials
- public publishing
- policy activation
- tool/specialist/agent/capability activation
- lifecycle mode change

## Criteria For Entering Mid-State

- identity purpose and profile are owner-approved
- authority model is clear
- offering/audience context has reviewed draft or approved state
- seed routes have eval coverage
- at least one external-facing or operating capability is proposed and approved for activation
- prompts exist for activated routes
- vector namespace use is policy-governed
- non-owner inbound behavior is tested
- payment and credential capabilities remain blocked unless approved and bound

For the Evergreen Hearth target example, see `specs/seed-to-evergreen-hearth-example.md`.
