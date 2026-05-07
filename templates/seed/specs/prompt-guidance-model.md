# Prompt Guidance Model

Prompt guidance files are operator-facing markdown with explicit dynamic context slots. Prep compiles the selected prompt into the runtime packet only when relevant.

## Standard Format

````md
Role: [1-2 sentences defining the model's function, context, and job]

# Dynamic sections

```yaml
constants: {}
identity_context: {}
policy: {}
tools: {}
conversation: {}
specialist_guidance: {}
```

# Personality
# Goal
# Success criteria
# Constraints
# Tool retry guidance
# Output
# Stop rules
````

## Dynamic Section Meanings

- `constants`: stable refs, ids, routes, and output contract names.
- `identity_context`: selected modules from `identity/context`, `identity/rules`, playbooks, and vector ref maps.
- `policy`: authority, privacy, approval requirements, risk thresholds.
- `tools`: available tools, unavailable tools, tool risk level, retry policy.
- `conversation`: safe summary, message refs, artifact refs, vector refs, missing context.
- `specialist_guidance`: route-specific or candidate-specialist guidance.

## Tool Retry Guidance

- Low-risk read-only tools may retry up to 2 times.
- Medium-risk draft, parse, or validation tools may retry once.
- High-risk tools that write, send, schedule, purchase, change policy, or mutate private memory should not retry blindly.
- If a tool fails in a way that could cause a commitment or privacy leak, route to `human_review`.
- If policy and tool output conflict, policy wins.

## Current Prompt Sources

- Planner: `identity_state/prompts/agents/runtime-orchestration-planner.md`
- Qualify lead: `identity_state/prompts/agents/qualify-lead.md`
- Compose reply: `identity_state/prompts/agents/compose-reply.md`
- Prepare estimate packet: `identity_state/prompts/agents/prepare-estimate-packet.md`
- Prepare work packet: `identity_state/prompts/agents/prepare-work-packet.md`
- Maintenance follow-up: `identity_state/prompts/agents/maintenance-followup.md`
- Human review: `identity_state/prompts/agents/human-review.md`
- Stop: `identity_state/prompts/agents/stop.md`

## Runtime Rule

The runtime contract stores prompt refs. Prep may compile prompt guidance into `planner_input` or `agent_input`.
