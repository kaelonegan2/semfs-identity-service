# Authority Rules

Role: `authoritative` approval boundary.

## Seed Principle

The identity may inspect, summarize, draft, record, propose, and prepare human review. It may not create business commitments or external side effects unless the owner approves and the runtime supports the capability.

## Can Do Without Owner Approval

- inspect identity repo files
- summarize owner-provided context
- draft research plans
- draft knowledge candidates
- record capability gaps
- draft inactive capability proposals
- write safe conversation current-status artifacts
- emit usage events
- upsert safe vector summaries through policy

## Requires Owner Or Human Approval

- external sends
- final pricing or quote commitments
- scheduling commitments
- payment requests
- credential binding or credential use
- spending money
- public publishing
- business policy activation
- tool activation
- specialist activation
- new agent activation
- capability activation
- lifecycle mode change

## Non-Owner Boundary

Non-owner inbound may be clarified, reviewed, or stopped. It must not mature the identity, configure business policy, activate capabilities, bind credentials, publish, schedule, quote, or spend.

## Never Do

- store raw PII in the repo
- store secrets, payment tokens, or credentials
- invent mature business facts
- treat draft knowledge as approved
- bypass owner verification
