# Stage Model

Role: `guidance` for autonomous stages.

Stages are runtime-agnostic work units. They are not n8n workflows, queue definitions, or executable graph nodes.

## Stage Modes

- `single`: one deterministic prep or persistence step.
- `parallel`: safe independent reads or checks may run in parallel.
- `selector`: sets or revises `decision.routing.next`.
- `selected_agent`: runs the agent selected by dispatch.
- `terminal`: ends the run or waits for approval.

## Stage List

### `entry`

Purpose: accept inbound message or operator task.

Mode: `single`

Outputs: initial runtime contract refs and inbound metadata.

Blocked: stop if inbound cannot be safely represented.

May set route: no.

### `triage`

Purpose: identify sender role, intent, urgency, risk, missing basics, and approval triggers.

Mode: `single`

Outputs: intent candidate, risk flags, trust posture summary.

Blocked: route to `clarify_intent` or `human_review`.

May set route: may suggest route; planner remains canonical.

### `context_resolution`

Purpose: load selected repo refs, conversation refs, lifecycle mode, authority posture, tools, and minimal vector context.

Mode: `parallel`

Outputs: compact context for planner or agent.

Blocked: return `needs_context`, `needs_tool`, or `safe_stop`.

May set route: no.

### `select`

Purpose: set `decision.routing.next`.

Mode: `selector`

Candidate agents: `runtime_orchestration_planner`.

Outputs: selected route, selected agent, stage plan.

Blocked: route to `human_review` or `stop`.

May set route: yes.

### `dispatch`

Purpose: resolve route to agent, prompt, tools, and output contract.

Mode: `single`

Outputs: selected agent metadata.

Blocked: record capability gap or route to `stop`.

May set route: no.

### `work`

Purpose: run selected agent.

Mode: `selected_agent`

Candidate agents: active agents in `identity_state/registries/agents.json`.

Outputs: facets, outbound draft or review packet, return status.

Blocked: agent returns a status such as `needs_context`, `needs_tool`, `needs_human_review`, or `capability_gap_detected`.

May set route: yes, if output contract allows `decision.routing.next`.

### `review_or_reply`

Purpose: prepare safe draft, clarification, review packet, or stop state.

Mode: `single`

Outputs: outbound draft, review packet, or final status.

Blocked: route to `human_review`.

May set route: yes.

### `hydrate`

Purpose: validate structured output and apply allowed facets to the runtime contract.

Mode: `single`

Outputs: hydrated contract.

Blocked: return `needs_tool` or route to `human_review`.

May set route: no.

### `persist`

Purpose: write safe conversation artifacts and propose repo/vector memory updates.

Mode: `single`

Outputs: artifact refs, vector upsert proposal refs.

Blocked: emit pending update and continue to closeout.

May set route: no.

### `authority_gate`

Purpose: enforce approval, ownership verification, lifecycle mode, outbound idempotency, and usage budget.

Mode: `single`

Outputs: allowed action, pending approval, or blocked status.

Blocked: route to `human_review` or `stop`.

May set route: yes.

### `closeout`

Purpose: end run, list pending approvals, usage summary, artifacts, and gaps.

Mode: `terminal`

Outputs: final status.

Blocked: stop with audit note.

May set route: no.

### `capability_gap`

Purpose: record a missing tool, skill, authority, context, prompt, or specialist.

Mode: `single`

Outputs: gap record and optional proposal draft.

Blocked: route to `human_review` if activation is requested.

May set route: yes.

`capability_gap` is a stage and facet-handling condition for normal operations, not a normal `decision.routing.next` entry. If the selected next action is owner-governed gap resolution, the runtime switches to an owner-authorized evolution profile and sets `decision.evolution.next = resolve_capability_gap`.
