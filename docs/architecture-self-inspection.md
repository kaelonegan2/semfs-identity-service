# SemFS Self-Inspection — Architecture & Design

Role: `guidance` for the V1 self-inspection capability.

This document records how SemFS currently represents itself, which conventions the inspector follows, and the smallest coherent design for deterministic self-inspection.

## How SemFS Currently Represents Itself

SemFS is two layers:

1. **Service runtime** (`src/`): prepares context, authorizes actions, validates outputs, and writes only allowlisted artifacts. It does not run LLMs or activate capabilities.
2. **Identity repository** (`templates/seed/` and initialized identity mounts): the portable semantic package that encodes lifecycle, status, registries, orchestration, governance, prompts, memory policy, evals, and capability evolution.

An identity repository represents itself through:

| Layer | Canonical surfaces |
| --- | --- |
| Traversal maps | `MAP.md` files with `Role:` headers and numbered read-order paths |
| Lifecycle | `identity_state/lifecycle/current.json`, `mode-permissions.json`, readiness score |
| Status | `identity_state/status/current.json` (`allowed_now`, `forbidden`, `canonical_paths`) |
| Registries | agents, tools, tool-aliases, output-contracts, facet-policy, specialists |
| Orchestration | `dispatch-map.json` (lifecycle-mode-aware routes) |
| Governance | usage/model policy under `identity_state/governance/` |
| Capability evolution | gaps, proposals, activation/gap schemas |
| Evals | seed markdown Q&A under `evals/`; service-side runtime scenarios under root `evals/` |
| Runtime contracts | `.runtime/contracts/*.schema.json` and `.runtime/requirements.json` |

Service-side loadability is gated by `IdentityLoader` required JSON files. Status also declares `canonical_paths`. Those two lists overlap but are not identical — the inspector reconciles them and reports uncertainty rather than silently choosing one.

## Conventions The Capability Follows

- **Deterministic / read-only by default.** No LLM calls. No automatic repair. No activation.
- **Schema-versioned machine output.** Follow `{domain}.v{n}` naming already used by lifecycle, readiness, runtime evals, and gap records.
- **Scope reuse.** Inspection is `identity:read` — same authority class as manifest/context.
- **Vector memory is non-canonical.** Findings come from repo files and structured indexes only.
- **Findings, not mutations.** Persistence is optional and must stay inside existing SafeWriter allowlists if added later.
- **Stop on conflicting conventions.** Emit `convention_uncertainty` findings instead of inventing a new source of truth.

## Smallest Coherent Design

One service (`SelfInspectionService`), one report schema (`identity_inspection_report.v1`), three entry points:

1. CLI: `pnpm inspect` → `src/inspect.ts`
2. REST: `GET /v1/identities/:identity_id/inspection`
3. MCP: `semfs_inspect_identity`

Optional human-readable markdown is derived from the same report object.

A small new convention, `evals/coverage.json` (`eval_coverage.v1`), links active agents/routes to eval refs so "implemented without evaluations" is machine-checkable without changing agent registry semantics.

### Finding types

| `finding_type` | Detection |
| --- | --- |
| `missing_canonical_file` | Required loader files ∪ `status.canonical_paths` ∪ root MAP read-order JSON |
| `invalid_ref` | Unresolved `*_ref`, dispatch `prompt`/`registry`, contract/facet names, proposal refs |
| `unmapped_file` | Repo files not reachable from MAP read-order lists or registry/canonical refs |
| `capability_without_impl` | Active agents missing prompt, contract, facet policy, or tool registry backing |
| `impl_without_eval` | Active agents/routes with no `evals/coverage.json` entry and no seed-eval mention |
| `eval_failing` | Latest `.evals/.../index.json` run with `failed > 0` |
| `eval_stale` | No recorded eval run, or coverage subjects without recent evidence |
| `open_task_issue` | Gap ledger entries that appear completed, obsolete, duplicated, or blocked |
| `governance_contradiction` | Dispatch ↔ mode-permissions ↔ status/lifecycle contradictions |
| `schema_violation` | JSON that fails adjacent `*.schema.json` or is unreadable |
| `stale_doc` | Docs/maps whose referenced paths are missing, or status claims that contradict registries |
| `convention_uncertainty` | Known conflicting conventions where the inspector refuses to pick a winner |

### Explicit non-goals (V1)

- Automatic repair or activation
- Treating vector-retrieved content as truth
- Semantic LLM review of prose quality
- Changing identity/governance semantics or permission boundaries
- External infrastructure / deployment
- Merging conflicting conventions into one canonical model

## Known Uncertainties (Do Not Auto-Resolve)

1. **Dual route tables** in `dispatch-map.json` (`lifecycle_modes.*.routes` vs top-level `routes`). Runtime prefers lifecycle modes; some dream paths read the flat table.
2. **`capability_gap` route** is active in dispatch/mode-permissions/README, while `gap-types.md` says not to add `decision.routing.next = capability_gap` to normal dispatch.
3. **Three gap representations** (`gap-record.schema.json`, prose `gaps.md`, runtime `capability_gap_record.v1`) with different status vocabularies.
4. **Canonical file list mismatch** between `IdentityLoader.REQUIRED_JSON_FILES` and `status.canonical_paths`.
5. **`operating_model/capabilities.md`** describes mature external-facing capabilities as an "Active Capability Surface" while seed status forbids those workflows.
6. **Multiple agent sources** (`registries/agents.json`, `operating_model/agents.json`, markdown agent maps).

The inspector reports these as findings/uncertainties. It does not rewrite governance or identity semantics.
