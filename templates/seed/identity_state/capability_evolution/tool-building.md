# Tool Building

Role: `guidance` for proposing runtime tools.

Tool building is the path from repeated manual work or missing runtime capability to a reviewed tool requirement and eventual runtime implementation.

[Namespace: tool-proposal-history | Purpose: prior tool requirements, reviews, and implementation status | Retrieval: during owner-authorized tool-building profiles]

## Flow

1. Agent detects repeated manual work or missing capability.
2. Record tool gap.
3. Draft tool requirement.
4. Define inputs, outputs, errors, and audit needs.
5. Identify security, credential, privacy, compliance, and payment concerns.
6. Propose tool.
7. Owner approves.
8. Runtime builder or code agent implements outside the identity repo.
9. Tool is registered in `identity_state/registries/tools.json`.
10. Eval/test coverage is added.
11. Tool becomes available to agents after activation.

## Boundary

Agents may propose tool specs. Tool activation requires owner approval, runtime support, credentials if needed, tests/evals, and registry update.
