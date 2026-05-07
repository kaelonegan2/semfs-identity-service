# Seed-State Expected Answers

Role: `example` expected conformance answers.

1. It knows it exists, has an owner role, has lifecycle `seed_runtime_available`, has baseline runtime tools, has authority boundaries, has seed agents/routes, and can mature safely.
2. It does not know identity purpose, business/domain, audience, offerings, operating area, pricing, FAQ, credentials, payments, private memory, or active external workflows.
3. `seed_runtime_available`.
4. `owner_onboarding`, `context_collect`, `clarify_intent`, `research_plan`, `knowledge_draft`, `capability_gap`, `capability_proposal`, `human_review`, `stop`.
5. `runtime_orchestration_planner`, `identity_evolution_manager`, `owner_onboarding`, `context_collector`, `business_research_planner`, `knowledge_drafter`, `capability_gap_manager`, `capability_proposal_writer`, `owner_review_coordinator`, `human_review`, `stop`.
6. Repo read, proposal writes, conversation artifact writes, SemFS/vector retrieve/upsert through policy, facet hydration, structured output validation, usage events, review packet creation, approval capture, gap recording, proposal creation.
7. Agent/tool permissions are listed in `identity_state/registries/agents.json` and `identity_state/registries/tools.json`.
8. It can inspect, summarize, draft, record gaps, propose inactive capabilities, write safe artifacts, emit usage events, and upsert safe summaries through policy.
9. External sends, final pricing/commitments, scheduling/capacity commitments, payment, credentials, spending, publishing, policy activation, tool/specialist/agent/capability activation, and lifecycle changes.
10. Route to `owner_onboarding`; recommend a maturation path and ask one high-leverage owner decision.
11. It should infer the setup sequence, draft assumptions, draft research plans, and prepare proposals before asking for details the owner should not have to design.
12. Questions about agents, routes, prompts, vector namespaces, schemas, dispatch maps, orchestration, or repo organization.
13. It uses readiness score, lifecycle, known profile summary, gaps, and safe defaults to recommend the next owner-simple step.
14. Evergreen Hearth is a separated maturation target under `examples/maturation-targets/evergreen-hearth/` and `specs/seed-to-evergreen-hearth-example.md`.
15. The runtime injects `contract` and `prep`, including lifecycle, readiness, known profile, conversation status, authority/trust, usage, allowed vector summaries, available tools, output contract, and prompt guidance.
16. Facets provide structured prior outputs such as context summary, research plan, knowledge draft, capability gap, or proposal. They inform the next agent but do not override authoritative repo policy.
17. Vector summaries may be injected only when policy allows; they are summaries, not canonical truth.
18. No.
19. `owner_onboarding`.
20. `capability_proposal`.
21. `knowledge_draft`.
22. Live sends, scheduling, payment requests, credential use, spending, automatic policy activation, and automatic activation of agents/tools/specialists.
23. It maps each low-score area to autonomous action, seed agent, baseline tool, artifact, approval need, and safe default.
24. Lead/intake qualification, service/offering Q&A, estimate/commitment packet preparation, payment capability, and private audience/property memory specialist.
25. It states a recommended default when owner input is missing, such as draft-only knowledge and no external-facing commitments.
26. Prompts explicitly forbid technical owner questions and require business/function-language recommendations.
