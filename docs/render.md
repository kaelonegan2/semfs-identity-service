# Deploy SemFS On Render

Render is an optional deployment adapter for SemFS. It is not required for self-hosting.

## Recommended Hosted Mode

Use the GitHub identity backend on Render. Render web services have an ephemeral filesystem unless you attach a persistent disk, so GitHub-backed identities are the safest default for hosted demos.

Required environment variables:

- `SEMFS_AUTH_TOKEN`
- `SEMFS_RUNTIME_AUTH_TOKEN`
- `SEMFS_DEFAULT_IDENTITY_ID`
- `SEMFS_IDENTITY_BACKEND=github`
- `SEMFS_GITHUB_REPO`
- `SEMFS_GITHUB_REF`
- `SEMFS_GITHUB_TOKEN`

Optional scoped credential variables:

- `SEMFS_ADMIN_AUTH_TOKEN`
- `SEMFS_OWNER_RUNTIME_AUTH_TOKEN`
- `SEMFS_READONLY_AUTH_TOKEN`
- `SEMFS_PUBLIC_AUTH_TOKEN`
- `SEMFS_PUBLIC_ACCESS=false`

Optional embedding variables:

- `SEMFS_EMBEDDINGS_BASE_URL`
- `SEMFS_EMBEDDINGS_MODEL`
- `SEMFS_EMBEDDINGS_API_KEY`

## Blueprint

Use [deploy/render/render.yaml](../deploy/render/render.yaml) as the Render Blueprint. The blueprint uses Render secret placeholders for GitHub and embedding credentials.

## Local Filesystem Mode

Local filesystem mode can work on Render only if you attach a persistent disk and set `SEMFS_IDENTITY_PATH` under the disk mount path. Without a disk, identity writes are lost on deploy or restart.

## Smoke Test

```bash
curl https://YOUR-SERVICE.onrender.com/health
curl -H "Authorization: Bearer $SEMFS_AUTH_TOKEN" \
  https://YOUR-SERVICE.onrender.com/v1/identities/$SEMFS_DEFAULT_IDENTITY_ID/manifest
```

Remote MCP clients should connect to:

```text
https://YOUR-SERVICE.onrender.com/mcp
```

with the same bearer token.
