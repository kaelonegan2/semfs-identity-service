# Agent Lifecycle

Capability evolution is modeled as an agent lifecycle when the new capability changes execution behavior.

## Lifecycle States

1. `gap_detected`
2. `candidate_agent`
3. `proposal_written`
4. `approved`
5. `activated`
6. `dispatchable`
7. `retired`

## Activation Requirements

An agent is dispatchable only when all are true:

- prompt guidance exists,
- registry entry exists with `status = active`,
- output contract exists,
- facet policy covers emitted facets,
- authority rules are clear,
- tool permissions are defined,
- eval questions are updated,
- human/operator approval is recorded when required.

## Proposal Contents

Every agent proposal should define:

- gap,
- proposed responsibility,
- input context refs,
- tools,
- output contract,
- emitted facets,
- authority limits,
- retry policy,
- activation checklist.

## Relationship To `capability_evolution/`

`identity_state/capability_evolution/` remains as an audit and governance archive. Active design work for agents should start here in `identity_state/agents/`.

