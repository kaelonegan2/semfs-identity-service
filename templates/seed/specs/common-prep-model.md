# Common Prep Model

Role: `runtime-compatibility`.

A compatible runtime compiles a common prep packet before invoking any active seed agent.

The runtime should provide two portable context objects:

- `contract`: compact runtime contract for the current run.
- `prep`: curated identity, authority, tool, vector, usage, and prompt context prepared for the selected agent.

This model is runtime-agnostic. It does not use provider-specific or n8n-specific expressions.

## Portable Placeholder Syntax

Prompts may reference fields using double braces:

```text
{{contract.ctx.identity_id}}
{{contract.ctx.conversation_id}}
{{contract.msg.summary}}
{{contract.decision.routing.next}}
{{contract.orchestration.stage}}
{{contract.facets.owner_onboarding}}
{{contract.facets.context_summary}}
{{contract.facets.research_plan}}
{{contract.facets.knowledge_draft}}
{{contract.facets.capability_gap}}
{{contract.facets.capability_proposal}}
{{contract.facets.human_review}}
{{contract.facets.closeout}}
{{contract.outbound}}
{{contract.audit}}

{{prep.identity.lifecycle_mode}}
{{prep.identity.readiness_score}}
{{prep.identity.known_profile_summary}}
{{prep.conversation.current_status}}
{{prep.authority.owner_verified}}
{{prep.authority.trust_level}}
{{prep.usage.budget_state}}
{{prep.vector_context.allowed_summaries}}
{{prep.available_tools}}
{{prep.output_contract}}
{{prep.prompt_guidance}}
```

## `contract`

`contract` contains compact run state:

- `ctx.identity_id`
- `ctx.conversation_id`
- `msg.summary`
- `decision.routing.next`
- `orchestration.stage`
- `facets`
- `outbound`
- `audit`

It must not carry the full repo, full prompt library, raw vector records, raw transcripts, credentials, payment tokens, or private records.

## `prep`

`prep` contains curated context for the selected agent:

- lifecycle mode and readiness score
- known profile summary
- conversation current status
- owner verification and trust level
- usage and budget state
- allowed vector summaries
- available tools
- output contract requirements
- prompt guidance

## Missing Context

Missing context should be represented explicitly as `unknown`, `not_available`, `not_enabled`, or `requires_owner_approval`.

Agents should not invent missing business/domain facts. They should draft assumptions, recommend safe defaults, or route to `human_review`.

## Facets

Facets are structured outputs from prior stages or agents. The runtime may inject relevant facets into `contract.facets.*` and `prep.prompt_guidance`.

If a facet conflicts with current lifecycle, authority, dispatch, or tool policy, authoritative repo files win and the runtime should route to `human_review`.

## Vector Summaries

The runtime may inject allowed vector summaries into `prep.vector_context.allowed_summaries`.

Vector summaries must be:

- route-scoped
- policy-allowed
- minimal
- safe to show to the selected agent
- clearly marked as summaries, not canonical repo truth

## Tool Availability

The runtime injects allowed tools into `prep.available_tools`. An absent tool should be treated as unavailable, not as a prompt for the owner to design a tool.

## Authority And Usage

The runtime injects owner verification, trust level, approval state, and budget status. Agents should use that context to choose safe defaults and escalation paths.
