# Self-Inspection

SemFS can deterministically inspect an identity repository and emit a structured report.

Inspection is read-only. It never repairs findings, activates capabilities, or treats vector-retrieved content as canonical truth.

## Entry Points

CLI:

```bash
pnpm inspect --root templates/seed --format both
pnpm inspect --root ./data/identity --out report.json --out-md report.md
```

REST:

```bash
curl -H "Authorization: Bearer $SEMFS_AUTH_TOKEN" \
  "http://127.0.0.1:8787/v1/identities/$SEMFS_DEFAULT_IDENTITY_ID/inspection"
```

Optional query params:

- `format=json|markdown`
- `eval_index=/path/to/.evals/runtime-orchestration/index.json`

MCP:

```text
semfs_inspect_identity
```

Scope: `identity:read` (same class as manifest/context).

## Output

Machine-readable schema: `identity_inspection_report.v1`

Human-readable markdown is derived from the same object (`human_report_markdown`).

## What It Detects

- Missing canonical files
- Invalid or unresolved internal references
- Files not represented in repository maps
- Declared capabilities without implementations
- Implemented capabilities without evaluations
- Failing or stale evaluations
- Open tasks/gaps that appear completed, obsolete, duplicated, or blocked
- Contradictions between current state and documented identity/governance
- Schema violations
- Documentation that no longer reflects repository behavior
- Known convention uncertainties (reported, not auto-resolved)

## What It Deliberately Cannot Detect

- Semantic correctness of prose that requires judgment beyond structural checks
- Whether an external runtime will honor policy at execution time
- Secret presence/absence in environment variables or credential stores
- Truthfulness of vector memory contents
- Future capability value or product desirability
- Whether a human approval *should* be granted
- Automatic repair opportunities (out of scope for V1)

## Related Surfaces

- Design notes: [architecture-self-inspection.md](architecture-self-inspection.md)
- Report schema: `templates/seed/.runtime/contracts/identity-inspection-report.schema.json`
- Eval coverage map: `templates/seed/evals/coverage.json`
- Adversarial evals: `evals/self-inspection/`
