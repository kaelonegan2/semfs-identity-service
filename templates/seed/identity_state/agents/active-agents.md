# Active Seed Agents

Role: `authoritative` seed agent overview.

Active agents are registered in `identity_state/registries/agents.json`.

## Active

- `runtime_orchestration_planner`: chooses seed route with `decision.routing.next`.
- `identity_evolution_manager`: recommends the next safe maturation step.
- `owner_onboarding`: explains the setup path and asks high-leverage owner questions.
- `context_collector`: summarizes known facts, assumptions, and unknowns.
- `business_research_planner`: drafts or summarizes public/business research plans.
- `knowledge_drafter`: drafts FAQ, service, intake, and policy candidates for review.
- `capability_gap_manager`: records missing capabilities and safe defaults.
- `capability_proposal_writer`: drafts inactive capability proposals.
- `owner_review_coordinator`: prepares and captures owner review decisions.
- `human_review`: packages authority or risk issues for human review.
- `stop`: halts processing safely.

## Inactive Future Agents

- `qualify_lead`
- `service_qa`
- `prepare_estimate_packet`
- `prepare_work_packet`
- `maintenance_followup`
- `payment_coordinator`
- `customer_property_memory_specialist`

Inactive agents must not be selected by `decision.routing.next` in seed mode.
