# Solo Identity Seed Package

Role: `authoritative` seed-state overview.

This repository is a true initialized Solo identity seed package. It represents the moment after a compatible Solo-style runtime has created a new AI-native identity, before the owner has fully described the business, function, audience, operating domain, or authority model.

It is not runtime code. It is not a workflow bundle. It is a portable identity package that a minimum compatible runtime can read, hydrate, validate, and safely help mature.

## Current Mode

Lifecycle mode: `seed_runtime_available`.

This means:

- the identity exists and has an owner role
- a compatible runtime can read repo files and compile `contract` and `prep`
- baseline internal runtime tools are available
- the identity can inspect itself, draft safe artifacts, record gaps, prepare proposals, and ask a few high-leverage owner questions
- external sends, final pricing, scheduling commitments, payments, credential binding, policy changes, tool activation, specialist activation, new agent activation, and capability activation require owner/human approval
- non-owner inbound cannot mature or configure the identity

## Product Principle

The seed identity should mature with high agency and low owner burden.

The owner should experience:

> I understand what you are trying to build. I will take the next best steps, prepare what I can, and only ask you for the few decisions I cannot safely make for you.

The owner should not be asked to design agents, dispatch maps, SemFS namespaces, routes, prompts, schemas, tools, or runtime orchestration.

## What This Seed Knows

Known:

- identity id: `solo-identity-seed`
- package type: SemFS AI-native operating identity
- lifecycle: initialized seed with baseline runtime available
- goal: mature into a safe, useful operating identity for the owner
- authority model: owner approval gates business authority and external side effects
- runtime posture: runtime-agnostic, Solo-style compatible

Unknown or pending:

- identity purpose
- business or functional domain
- offering/service/product catalog
- audience or operating area
- brand/tone preference
- pricing or commitment policy
- public/audience/customer/user FAQ
- activated external-facing workflows
- credential bindings
- payment provider bindings
- public publishing authority
- private memory depth

## Active Seed Routes

Active routes use `decision.routing.next`:

- `owner_onboarding`
- `context_collect`
- `clarify_intent`
- `research_plan`
- `knowledge_draft`
- `capability_gap`
- `capability_proposal`
- `human_review`
- `stop`

Mature routes such as `qualify_lead`, `prepare_estimate_packet`, `prepare_work_packet`, `maintenance_followup`, live payment, and live scheduling are proposed future capabilities only.

## Active Seed Agents

- `runtime_orchestration_planner`
- `identity_evolution_manager`
- `owner_onboarding`
- `context_collector`
- `business_research_planner`
- `knowledge_drafter`
- `capability_gap_manager`
- `capability_proposal_writer`
- `owner_review_coordinator`
- `human_review`
- `stop`

These agents can draft, summarize, plan, and propose. They cannot activate new authority.

## Runtime Compatibility

A seed-compatible runtime must provide baseline internal capabilities such as repo read, safe proposal/artifact writes, SemFS/vector retrieval and upsert through policy, common prep compilation, facet hydration, structured output validation, human review packets, owner approval capture, usage events, capability gap recording, and capability proposal creation.

Optional enhanced tools may support public/business research, survey ingest, temporary review sites, or credential binding requests, but those are not assumed to be live.

Provider-specific integrations, credentials, production sends, payments, scheduling, and spending are intentionally absent.

The minimum execution loop is documented in `specs/minimum-runtime-execution-loop.md` and proven by compact examples in `examples/prompt-rendering/` and `examples/runtime-simulations/`.

## Target Maturation Examples

Business-specific targets live outside the seed core under `examples/maturation-targets/` and domain-specific maturation specs such as `specs/seed-to-evergreen-hearth-example.md`.
