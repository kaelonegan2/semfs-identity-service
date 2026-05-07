# Secret Boundaries

Role: `authoritative` secret boundary.

## Repo May Store

- Credential alias.
- Required scope.
- Tool or integration needing it.
- Approval status.
- Expiration/review date.
- Runtime-private binding ref.
- Audit/event refs.

## Repo Must Not Store

- API keys.
- OAuth refresh/access tokens.
- Passwords.
- Private keys.
- Webhook secrets.
- Payment processor secrets.
- Email routing secrets.
- Verification bypass details.

## Runtime Responsibility

The runtime stores secrets in a secret manager and exposes only safe alias/status information to agents.
