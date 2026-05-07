# Solo Identity Seed Map

Role: `authoritative` traversal map.

This seed repo preserves the SemFS portability shape of a mature identity while keeping the core business-agnostic. It is structured enough for a compatible runtime to operate, but intentionally under-contextualized.

## Read Order

For a compatible runtime:

1. `identity_state/lifecycle/current.json`
2. `identity_state/lifecycle/mode-permissions.json`
3. `.runtime/contracts/common-prep.schema.json`
4. `identity_state/orchestration/dispatch-map.json`
5. `identity_state/registries/agents.json`
6. `identity_state/registries/tools.json`
7. `identity_state/registries/output-contracts.json`
8. `identity_state/registries/facet-policy.json`
9. `.runtime/requirements.json`
10. `.runtime/contracts/facet-output.schema.json`

For the owner:

1. `README.md`
2. `identity_state/lifecycle/readiness-score.md`
3. `identity_state/prompts/agents/owner-onboarding.md`
4. `examples/seed-state/README.md`

For a runtime/spec designer:

1. `.runtime/README.md`
2. `.runtime/compatibility.md`
3. `specs/common-prep-model.md`
4. `specs/minimum-runtime-execution-loop.md`
5. `examples/prompt-rendering/README.md`
6. `examples/runtime-simulations/README.md`
7. `.runtime/tools/baseline-tools.md`
8. `specs/semfs-upsert-model.md`
9. `specs/seed-to-midstate-maturation-path.md`

## Top-Level Folders

- `identity/`: seed identity book. It contains owner-known placeholders, authority rules, and future playbook targets.
- `identity_state/`: active seed state, registries, lifecycle, prompts, orchestration, memory policy, and capability evolution.
- `.runtime/`: runtime-compatibility surface. It is documentation and schema, not runtime code.
- `examples/seed-state/`: business-neutral proof examples.
- `examples/maturation-targets/`: clearly separated domain-specific maturation targets.
- `specs/`: portable model explanations for runtime builders and identity designers.
- `evals/`: tests for true seed behavior.

## Seed Modeling Rule

This repo answers: what does a newly initialized AI-native identity need in order to begin maturing itself safely?

It does not pretend to know the business yet.

It helps the runtime infer, research, draft, and propose before asking the owner, while requiring approval for authority-bearing actions.
