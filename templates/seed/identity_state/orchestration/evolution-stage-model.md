# Evolution Stage Model

Role: `guidance` for owner-governed identity evolution stages.

Evolution stages are semantic work units for building identity capability. They are separate from normal external-operation stages.

## Stages

- `owner_intake`: collect owner-provided facts, goals, constraints, and approval posture.
- `research_plan`: define research questions, needed sources, tools, and review requirements.
- `source_collection`: use runtime-provided research tools to gather candidate sources.
- `source_evaluation`: score source relevance, recency, authority, and uncertainty.
- `synthesis`: summarize findings into safe proposed knowledge.
- `knowledge_draft`: draft Q&A, playbooks, or identity guidance.
- `confidence_scoring`: mark confidence, source basis, and reviewer needs.
- `owner_review`: prepare review packet and record approval result.
- `feedback_ingest`: ingest public-site or survey feedback through runtime-provided tools.
- `gap_triage`: classify missing tool, skill, specialist, prompt, authority, or knowledge.
- `requirement_draft`: draft tool/specialist/credential/payment requirements.
- `security_compliance_review`: identify credential, privacy, payment, compliance, and side-effect risks.
- `activation_plan`: list exact registry, prompt, contract, eval, tool, and approval changes needed.
- `writeback`: write approved repo artifacts and propose vector memory upserts.

## Blocking Rule

If owner authorization or runtime tools are missing, evolution stages may draft requirements and review packets only. They must not activate capability or assume credentials.
