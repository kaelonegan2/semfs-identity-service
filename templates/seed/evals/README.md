# Seed Evals

Role: `guidance` for testing seed repo readability and conformance.

These evals test whether an agent can understand the initialized Solo seed identity using only this repo.

## What The Evals Prove

- The agent can identify `seed_runtime_available`.
- The agent can list active seed routes, agents, tools, output contracts, and facets.
- The agent knows what the identity does and does not know at initialization.
- The agent understands high-agency, owner-simple maturation.
- The agent understands `contract` and `prep` runtime context injection.
- The agent avoids technical owner questions.
- The agent knows what requires approval.
- The agent blocks non-owner maturation.
- The agent distinguishes baseline internal tools from optional and mature tools.
- The agent understands vector memory begins empty.
- The agent can explain how seed can mature into a mid-state identity like Evergreen Hearth.
