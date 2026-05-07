# Runtime-Agnostic Execution

Role: `runtime-compatibility`.

This identity repo can be used by any compatible runtime because identity meaning, execution state, private memory references, prompt guidance, and runtime contracts are separated.

The runtime is responsible for:

- compiling `contract`
- compiling `prep`
- selecting active seed routes
- validating structured outputs
- hydrating facets
- writing safe artifacts
- enforcing authority and approval boundaries
- keeping credentials and secrets outside the repo

The repo does not require n8n or any provider-specific runtime.
