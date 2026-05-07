# Identity Lifecycle Map

Role: `authoritative` lifecycle map.

`identity_state/lifecycle/` defines the maturity mode for this identity and the permissions that follow from that mode.

## Read First

1. `current.json`
2. `current.md`
3. `maturity-model.md`
4. `mode-permissions.json`
5. `evolution-profiles.md`
6. `evolution-profiles.json`

## Authoritative Files

- `current.json`: current machine-readable lifecycle state.
- `mode-permissions.json`: machine-readable permission boundaries by mode.
- `evolution-profiles.json`: machine-readable owner-governed maturation profiles.

## Guidance Files

- `current.md`: human-readable current mode summary.
- `maturity-model.md`: lifecycle model and expectations for each mode.
- `evolution-profiles.md`: semantic profiles for identity bootstrap, research, knowledge, tooling, specialists, credentials, payments, and optimization.

## Runtime Rule

Lifecycle mode constrains autonomy. A runtime may choose a more restrictive posture than the current mode, but it must not exceed the permissions for the current mode.
