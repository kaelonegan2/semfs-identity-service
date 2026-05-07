# Current Runtime Salvage Plan

Role: `guidance` for reusing lessons from the current runtime prototype.

This plan identifies ideas worth carrying into Solo Runtime Core and ideas that should not be copied into this identity repo. Validate against the actual runtime project before implementation.

## Reuse

- Build and deploy scripts, if they are cleanly separable from prototype-specific config.
- Canonical workflow organization.
- Runtime agent template concept.
- Universal facet mutator.
- Structured output parser.
- Hydrate contract mechanism.
- Semantic filesystem manager.
- Early classifier concept.
- Smoke test harness.

## Rewrite Before Reuse

- Instance configuration should become small contract refs plus repo registries.
- Prompt bundles should become prompt guidance files.
- Graph execution should become a simple dispatch model driven by `decision.routing.next`.
- Facet policy should become a registry ref, not a giant injected object.

## Do Not Copy Directly

- Current large instance config.
- Large `control_plane` object.
- `compat_projection` as a runtime concept.
- Full graph/registry injection.
- Bloated prompts.
- Embedded giant facet policy.
- Runtime payloads over 100KB.
- Compatibility layers that exist only because the prototype grew organically.

## Keep The Identity Repo Clean

The identity repo should declare requirements, registries, prompt guidance, examples, and semantic constraints. Runtime code, workflow blobs, credentials, deployment scripts, and large instance configs belong in the runtime implementation repository.

## Clean Runtime Core Direction

Build the next runtime around:

1. small runtime contract,
2. prep compiler,
3. registered agents,
4. route dispatch by `decision.routing.next`,
5. structured parser,
6. facet hydration,
7. SemFS/vector upsert,
8. audit and approval gates.
