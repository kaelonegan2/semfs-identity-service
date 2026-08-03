# Self-Inspection Evals

These scenarios prove SemFS can deterministically inspect an identity repository and detect structural, governance, eval, and documentation problems.

```bash
pnpm eval:inspection
```

## Adversarial Coverage

`adversarial-identity.json` points at `tests/fixtures/inspection/adversarial-identity`, a deliberately broken identity. It verifies that inspection:

- reports missing canonical files and unresolved refs
- finds unmapped files
- flags declared capabilities without implementations
- flags implemented agents/routes without eval coverage
- surfaces failing and stale eval indexes
- notices open-task/gap ledger problems
- reports governance contradictions and schema violations
- reports stale docs/maps
- does **not** treat `vector-retrieved-falsehood.md` as canonical truth

No scenario repairs the fixture. Inspection is read-only.
