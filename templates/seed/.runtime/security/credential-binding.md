# Runtime Credential Binding

Role: `runtime-compatibility` credential boundary.

A compatible runtime binds credentials outside the identity repo.

## Runtime Must Provide

- Secret manager or equivalent credential storage.
- Credential alias registry.
- Scope enforcement.
- Approval/audit records.
- Expiration and revocation behavior.
- Safe alias/status exposure to agents.

## Runtime Must Not Expose

- Raw secrets.
- Tokens.
- Private keys.
- Webhook secrets.
- Payment processor credentials.
- OAuth refresh tokens.

## Agent View

Agents may see:

```json
{
  "credential_alias": "payment_provider_link_create",
  "status": "bound_runtime_private",
  "scope": ["create_payment_link"],
  "runtime_private_binding_ref": "runtime-private://credential/..."
}
```

Agents must not see the credential value.
