# SemFS Identity Service

SemFS is an open source identity service for AI agents, created by Kaelon Egan. It gives external agents a stable REST and MCP surface for understanding, using, and safely maturing an identity repository.

The project is MIT licensed so builders can use, fork, host, and extend it freely. The goal is to make identity repositories a practical substrate for agent runtime, memory, policy, review, and maturation.

An identity repository can represent a person, project, team, business, product, or other long-lived operating context. SemFS makes that repository agent-readable: it exposes the identity manifest, lifecycle state, internal agents, roles, policies, prompts, tools, specialists, skills, semantic memory namespaces, review flows, and safe write targets.

SemFS does not run LLMs. It prepares context, authorizes actions, validates outputs, and writes only explicitly safe artifacts. Reasoning and execution happen in the calling agent or runtime.

## Project Status

SemFS is early, active infrastructure. The V1 boundary is intentionally conservative: it can initialize seed identity repositories, prepare runtime context, expose scoped MCP tools, validate policy, and write safe artifacts, but it does not autonomously activate capabilities or perform external side effects.

The seed identity is designed to mature safely. It starts under-contextualized, collects owner-approved direction over time, records gaps, prepares review packets, and supports bounded "dreaming" flows for identity evolution proposals.

## What SemFS Provides

- Seed identity initialization for a brand-new identity repository.
- Identity inspection through manifest and context endpoints.
- Internal agent retrieval with prompts, policies, tools, skills, specialists, contracts, and memory access.
- Agent action preparation, authorization, and output validation.
- Semantic memory surfaces with namespace and privacy policy checks.
- Review packet and approval record capture.
- Dreaming flows for autonomous identity maturation proposals.
- Safe artifact writes with allowlisted paths.
- REST API and MCP tools over stdio or hosted Streamable HTTP.
- Optional Render deployment adapter.

## Core Concepts

**Identity**  
A repository-backed operating context. In business terms, an identity is the durable organization of knowledge, policies, capabilities, authority, memory, and working state.

**Internal agent**  
An executable surface inside the identity. Internal agents have prompts, tool permissions, policies, skills, specialists, contracts, and memory access. External agents retrieve these surfaces from SemFS, then act according to the returned guidance.

**Role**  
A persona, authority posture, or meta-agent position inside the identity. Roles are not executable agents by themselves.

**Semantic memory**  
Policy-governed vector namespaces for deeper identity knowledge. SemFS validates namespace use and returns filtered summaries and references instead of exposing private raw memory by default.

**Dreaming**  
A bounded evaluation flow for maturing the identity. SemFS prepares dream packets and validates findings such as missing context, capability gaps, inactive proposals, specialist gaps, skill gaps, tool gaps, knowledge candidates, research plans, and review needs. V1 blocks activation-like behavior, credential changes, external sends, publishing, payments, lifecycle changes, and registry edits.

## Runtime Boundary

SemFS intentionally does not:

- call LLMs
- send external messages
- activate tools, agents, specialists, policies, or capabilities
- bind credentials
- request payments
- publish public content
- bypass review for authority-bearing actions

Those remain outside the V1 execution boundary.

## Design Principles

- Identity state should be repository-backed, inspectable, and versionable.
- Agents should hydrate identity context before acting.
- Runtime authority should come from scoped credentials and identity policy, not from model claims.
- Memory should be policy-filtered and namespace-aware.
- Maturation should produce reviewable findings and proposals, not silent capability activation.
- Public, runtime, owner-runtime, and admin access should expose different surfaces.

## Quick Start

Requirements:

- Node.js 22+
- pnpm 9+

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

All endpoints except `/health` require bearer auth:

```text
Authorization: Bearer $SEMFS_AUTH_TOKEN
```

SemFS supports scoped credentials. `SEMFS_AUTH_TOKEN` is kept as a backward-compatible admin token. For hosted runtimes, prefer class-specific tokens:

- `SEMFS_ADMIN_AUTH_TOKEN`: initialization and administrative repair.
- `SEMFS_OWNER_RUNTIME_AUTH_TOKEN`: owner-authorized runtime work without seed replacement.
- `SEMFS_RUNTIME_AUTH_TOKEN`: normal agent runtime access.
- `SEMFS_READONLY_AUTH_TOKEN`: inspection-only access.
- `SEMFS_PUBLIC_AUTH_TOKEN` or `SEMFS_PUBLIC_ACCESS=true`: public status-only access.

MCP tools are registered per request from the authenticated credential's scopes. A runtime token cannot expose admin-only tools to the model.

## Environment

Common local configuration:

```bash
SEMFS_HOST=127.0.0.1
SEMFS_PORT=8787
SEMFS_AUTH_TOKEN=dev-token-change-me
SEMFS_RUNTIME_AUTH_TOKEN=runtime-token-change-me
SEMFS_DEFAULT_IDENTITY_ID=solo-identity-seed
SEMFS_IDENTITY_BACKEND=local
SEMFS_IDENTITY_PATH=./data/identity
SEMFS_VECTOR_STORE=memory
```

GitHub-backed identity configuration:

```bash
SEMFS_IDENTITY_BACKEND=github
SEMFS_GITHUB_REPO=owner/identity-repo
SEMFS_GITHUB_REF=main
SEMFS_GITHUB_TOKEN=ghp_...
```

Render deployments should prefer the GitHub backend so identity writes survive deploys. Local disk mode is useful for development or self-hosting with persistent storage.

## Initialize A Seed Identity

Initialize a new local identity repository:

```bash
curl -X POST http://127.0.0.1:8787/v1/identities/initialize \
  -H "Authorization: Bearer dev-token-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "identity_id": "new-identity",
    "display_name": "New Identity",
    "owner_placeholder": "Identity owner",
    "template_version": "0.1.0",
    "target": {
      "backend": "local",
      "path": "./data/new-identity"
    }
  }'
```

Initialize an existing empty GitHub repo:

```bash
curl -X POST https://your-semfs-service.example/v1/identities/initialize \
  -H "Authorization: Bearer $SEMFS_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "identity_id": "new-identity",
    "display_name": "New Identity",
    "owner_placeholder": "Identity owner",
    "template_version": "0.1.0",
    "target": {
      "backend": "github",
      "repo": "owner/identity-repo",
      "ref": "main"
    }
  }'
```

By default, SemFS refuses to overwrite existing SemFS files. Pass an explicit replace mode only when intentionally regenerating a compatible seed.

## REST API

Identity:

- `POST /v1/identities/initialize`
- `GET /v1/identities/:identity_id/status`
- `POST /v1/identities/:identity_id/inbound/prepare`
- `GET /v1/identities/:identity_id/manifest`
- `GET /v1/identities/:identity_id/context`
- `POST /v1/identities/:identity_id/profile/apply-owner-seed`

Agents:

- `GET /v1/identities/:identity_id/agents`
- `GET /v1/identities/:identity_id/agents/:agent_id`
- `POST /v1/identities/:identity_id/agents/:agent_id/prepare-action`
- `POST /v1/identities/:identity_id/agents/:agent_id/authorize-action`
- `POST /v1/identities/:identity_id/agents/:agent_id/validate-output`

Runs:

- `POST /v1/identities/:identity_id/runs/prepare-planner`
- `POST /v1/identities/:identity_id/runs/resolve-route`
- `POST /v1/identities/:identity_id/runs/prepare-agent`
- `POST /v1/identities/:identity_id/runs/hydrate`

Memory:

- `POST /v1/identities/:identity_id/vector/upsert`
- `POST /v1/identities/:identity_id/vector/search`

Safe writes and review:

- `POST /v1/identities/:identity_id/artifacts/write-safe`
- `POST /v1/identities/:identity_id/review-packets`
- `POST /v1/identities/:identity_id/approvals`

Dreaming:

- `POST /v1/identities/:identity_id/dreams/prepare`
- `POST /v1/identities/:identity_id/dreams/validate`
- `POST /v1/identities/:identity_id/dreams/write-safe`

See [docs/api.md](docs/api.md) for a compact endpoint reference.

## MCP Usage

SemFS ships a stdio MCP server:

```bash
pnpm mcp
```

The HTTP service also exposes stateless MCP Streamable HTTP:

```text
POST /mcp
Authorization: Bearer $SEMFS_AUTH_TOKEN
```

Core tools:

- `semfs_initialize_identity`
- `semfs_get_identity_status`
- `semfs_prepare_inbound`
- `semfs_get_manifest`
- `semfs_apply_owner_identity_seed`
- `semfs_get_agent`
- `semfs_prepare_agent_action`
- `semfs_authorize_agent_action`
- `semfs_validate_agent_output`
- `semfs_prepare_dream`
- `semfs_validate_dream`
- `semfs_write_safe_dream_outputs`
- `semfs_vector_search`
- `semfs_vector_upsert`
- `semfs_write_safe_artifact`
- `semfs_create_review_packet`
- `semfs_capture_approval`

See [docs/mcp.md](docs/mcp.md).

A versioned starter runtime prompt for external agents is available at [docs/runtime-prompt.md](docs/runtime-prompt.md).

## Agent Flow

A typical external agent flow is:

1. Call `semfs_get_identity_status` to determine whether the identity is `ready`, `uninitialized`, or `incomplete`.
2. If the identity is uninitialized and the runtime is configured to do so, call `semfs_initialize_identity`.
3. Call `semfs_prepare_inbound` to get a compact identity-aware packet for the inbound message.
4. Call `semfs_get_manifest` or `semfs_get_agent` only when the compact packet is insufficient.
5. Call `semfs_prepare_agent_action` with the intended task and available context when additional action prep is needed.
6. Follow the returned prompts, policies, tool permissions, contracts, and memory guidance.
7. Call `semfs_authorize_agent_action` before authority-bearing or tool-mediated work.
8. Call `semfs_validate_agent_output` before saving or returning material outputs.
9. Use review packets or safe artifact writes when the identity requires human review.

The seed identity starts conservatively: owner onboarding first, no technical owner burden, safe context capture, and review routing for authority-bearing work.

## Dreaming Flow

A typical maturation flow is:

1. Call `semfs_prepare_dream` with a scope such as `profile`, `knowledge`, `capabilities`, `authority`, `memory`, `agents`, `tools`, `specialists`, `skills`, or `all`.
2. Have an external agent evaluate the returned packet.
3. Submit findings to `semfs_validate_dream`.
4. Write validated findings through `semfs_write_safe_dream_outputs`.

SemFS writes only safe maturation artifacts such as review queue entries, draft proposals, research plans, or human review packets.

## Identity Backends

V1 includes:

- `local`: reads and writes identity files on disk.
- `github`: reads and writes identity files to a GitHub repository.

The service internals resolve all identities through `identity_id`, even when a simple deployment configures one default identity via environment.

## Render Deployment

Render support lives in:

- [deploy/render/render.yaml](deploy/render/render.yaml)
- [docs/render.md](docs/render.md)

Recommended hosted setup:

- Use the GitHub identity backend.
- Set `SEMFS_AUTH_TOKEN`.
- Set `SEMFS_DEFAULT_IDENTITY_ID`.
- Set `SEMFS_GITHUB_REPO`, `SEMFS_GITHUB_REF`, and `SEMFS_GITHUB_TOKEN`.
- Use `/health` as the health check path.

Render local filesystems are ephemeral unless a persistent disk is attached, so GitHub-backed identity storage is the default recommendation for demos and hosted deployments.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

Useful scripts:

- `pnpm dev`: run the REST and HTTP MCP service from TypeScript.
- `pnpm start`: run the compiled service from `dist`.
- `pnpm mcp`: run the stdio MCP server.
- `pnpm test`: run the Vitest test suite.

## Repository Layout

```text
src/
  config/          Environment configuration
  mcp/             MCP stdio and Streamable HTTP tool surface
  server/          Fastify REST service
  services/        Identity, agent, policy, dream, vector, and write services
  stores/          Local and GitHub identity backends
  types/           Shared TypeScript types
templates/seed/    Versioned seed identity template
docs/              API, MCP, and deployment docs
deploy/render/     Optional Render adapter
tests/             Service tests
```

## License

MIT. See [LICENSE](LICENSE).

Copyright (c) 2026 Kaelon Egan and SemFS contributors.
