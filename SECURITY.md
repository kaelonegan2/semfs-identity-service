# Security Policy

SemFS is designed around scoped runtime access and conservative identity maturation. The service should not expose admin tools, private memory, credentials, or write authority to callers that do not have the required token class and scope.

## Supported Version

SemFS is pre-1.0. Security fixes target the current `main` branch unless a maintained release line is published later.

## Reporting a Vulnerability

If you find a vulnerability, please open a GitHub security advisory or contact the maintainer privately before publishing details.

Useful reports include:

- affected endpoint or MCP tool
- token class or scope involved
- expected behavior
- observed behavior
- reproduction steps
- whether credentials, private identity data, safe-write paths, or external side effects are involved

## Security Boundaries

Important boundaries to preserve:

- Runtime tokens must not expose admin-only tools.
- Public access must remain public-safe.
- Owner authority must not be inferred from a model claim alone.
- Safe writes must stay within allowlisted paths.
- Memory retrieval must return policy-filtered summaries or references, not raw private records by default.
- Dreaming and maturation flows must not activate tools, agents, policies, credentials, payments, publishing, or lifecycle changes.

Do not put production secrets, identity-private data, or real credential material in issues, examples, tests, or seed templates.
