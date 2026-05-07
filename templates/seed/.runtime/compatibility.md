# Seed Runtime Compatibility

Role: `runtime-compatibility`.

The seed identity is compatible with runtimes that can provide safe internal operating support without requiring live business integrations.

## Seed-Compatible

Required:

- route with `decision.routing.next`
- respect `seed_runtime_available`
- use only active seed routes and agents
- compile `contract` and common `prep`
- validate seed output contracts
- hydrate facets from `identity_state/registries/facet-policy.json`
- enforce owner approval gates
- block non-owner maturation
- keep full repo contents out of runtime contracts
- keep secrets and payment credentials outside the repo

## Optional Enhanced

Optional enhanced runtime tools may do research, source scoring, survey ingest, setup-request drafting, or credential/payment binding requests. They cannot activate authority on their own.

## Mature-Compatible

Mature runtimes can later support live messaging, scheduling, payment, CRM/system-of-record writes, and public publishing only after owner approval, credential binding, eval/conformance coverage, and capability activation records exist.
