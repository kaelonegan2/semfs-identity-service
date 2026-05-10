# Specs Index

Role: `guidance` for runtime builders and identity designers.

`specs/` explains the portable model behind this identity repo. Specs are not executable workflows and should not be copied wholesale into runtime contracts.

## Read Order

1. `identity-repo-operating-model.md`
2. `runtime-agnostic-execution.md`
3. `runtime-contract.md`
4. `orchestration-model.md`
5. `agent-model.md`
6. `prompt-guidance-model.md`
7. `vector-reference-model.md`
8. `owner-context-to-semfs-ops.md`
9. `semfs-upsert-model.md`
10. `capability-evolution.md`
11. `identity-template-model.md`
12. `current-runtime-salvage-plan.md`

For current mid-state autonomy, also read `identity_state/lifecycle/`, `identity_state/authority/`, and `identity_state/governance/`.

For vector namespace maps, markdown `[Namespace: ...]` references, retrieval rules, and upsert metadata, read `identity_state/memory/`.

## Authoritative References

The specs explain the model. The authoritative runtime compatibility surface is `.runtime/`. The authoritative dispatch and registry files are under `identity_state/`.

## What Not To Treat As Executable Truth

Specs describe patterns and constraints. They do not define a live graph, tool credentials, deployed workflows, or external send permissions.
