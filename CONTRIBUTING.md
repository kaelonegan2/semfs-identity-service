# Contributing to SemFS

SemFS is early infrastructure for agent-readable, policy-governed identity repositories. Contributions are welcome when they preserve the core boundary: SemFS prepares, authorizes, validates, and writes safe artifacts, but does not silently activate capabilities or perform external side effects.

## Good First Contributions

- Improve docs, examples, and deployment notes.
- Add tests around runtime authorization and MCP tool exposure.
- Improve compact runtime packets and seed identity posture.
- Add safe identity repository templates, schemas, and conformance examples.
- Harden storage backends and error handling.

## Development

Requirements:

- Node.js 22+
- pnpm 9+

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Pull Request Expectations

- Keep changes focused.
- Add or update tests for behavior changes.
- Do not commit credentials, tokens, private identity data, or generated local runtime artifacts.
- Preserve scoped authorization boundaries between public, readonly, runtime, owner-runtime, and admin access.
- Avoid adding model-specific assumptions to the SemFS service layer. Identity-specific behavior should come from identity state, prompt guidance, policy, or runtime-provided context.

## Security-Sensitive Changes

Changes touching authentication, credential handling, safe writes, GitHub storage, memory policy, MCP tool exposure, or approval flows should include tests and a short explanation of the trust boundary being preserved.
