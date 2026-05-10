# Runtime Orchestration Evals

These evals exercise SemFS as an orchestration substrate. Each scenario describes an inbound turn, the runtime capabilities reported for that run, a planner-produced action map, and expected SemFS calls/artifacts.

The fixture planner is deterministic and is used for CI:

```bash
pnpm eval:runtime
```

By default the command stores results in ignored local files under `.evals/runtime-orchestration/` and updates `.evals/runtime-orchestration/index.json` with provider/model performance rollups. Each run writes a full `.json` trace and a human-readable `.md` report. Use `--no-write` when you only want stdout, or `--out path/to/result.json` when you want a specific result location.

To evaluate a model as the planner, use an OpenAI-compatible chat-completions endpoint:

```bash
SEMFS_EVAL_PROVIDER=openai-compatible \
SEMFS_EVAL_MODEL="$MODEL_NAME" \
SEMFS_EVAL_API_KEY="$API_KEY" \
pnpm eval:runtime -- --out eval-results.json
```

Model evals receive only the public scenario input and available SemFS tool names. Expectations and fixture plans are withheld from the model and used only by the scorer.

Scenarios include `suite`, `identity_stage`, and `tags` metadata so local/internal results can be compared across seed, mid-state, mature, or domain-specific identity profiles without committing generated benchmark history.

## What They Check

- Runtime capability snapshots are required before orchestration powers are used.
- Inline, parallel, and continuation sub-agent runs are explicit, scoped, and policy-bound.
- Agent-runtime grants expose only allowed SemFS tools.
- Direct sub-agent response is denied unless both runtime capability and policy grant it.
- External lookup is not assumed when the runtime does not report it.
- Owner-turn maturation records safe context and artifacts without activating live capabilities.
- Human-facing final responses stay conversational: scenarios can require helpful phrases with `text_contains` and reject internal or overly technical wording with `text_excludes`.
