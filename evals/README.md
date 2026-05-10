# SemFS Evals

Tracked eval scenarios live under `evals/`. They are part of the repository because they describe expected SemFS behavior across identity stages and runtime surfaces.

Generated eval results live under `.evals/`, which is ignored by git. That keeps local/internal model benchmark history out of forks while still making the harness and public scenario definitions available to maintainers.

## Result Storage

By default:

```bash
pnpm eval:runtime
```

writes a result file to:

```text
.evals/runtime-orchestration/{provider}/{model}/{run_id}.json
.evals/runtime-orchestration/{provider}/{model}/{run_id}.md
```

It also updates:

```text
.evals/runtime-orchestration/index.json
```

The index contains recent run summaries and model performance rollups. Use `--out` to write a specific result path, or `--no-write` to print JSON without storing a run.

Use the `.md` report for human review. It shows each inbound, captured final response text, action sequence, statuses, and required artifacts. The `.json` file remains the full machine-readable trace.

Scenarios can also score final response wording. Use `text_contains` for phrases that must appear and `text_excludes` for internal or overly technical language that should never leak into human-facing responses.

## Identity Stages

Each scenario can declare:

- `suite`
- `identity_stage`
- `tags`

Current scenarios target the `seed` stage. Future scenario packs can add `mid-state`, `mature`, or domain-specific identity stages while using the same runner and score format.
