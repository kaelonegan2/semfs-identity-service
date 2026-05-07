# Deployment Context

Role: `runtime-compatibility` deployment guidance.

This repo is not a runnable app. It is a semantic identity package.

## Deployer Responsibilities

A deployer must bind:

- a compatible orchestration runtime,
- repo read access,
- SemFS/vector retrieval and upsert storage,
- outbound send tools,
- approval and human-review surfaces,
- audit logging,
- persistence for runtime contracts and conversation artifacts,
- any CRM, calendar, estimating, or notification tools.

## What Belongs In Runtime Implementation

- Build and deploy scripts.
- Workflow definitions.
- Worker code.
- Tool credentials.
- External send integrations.
- Vector database adapters.
- UI for approvals and review.

## What Belongs In This Identity Repo

- Requirements and compatibility declarations.
- Business identity and policy.
- Prompt guidance.
- Registries and dispatch maps.
- Portable specs and examples.

The identity repo can declare what must exist. It should not package runtime-specific workflow blobs.
