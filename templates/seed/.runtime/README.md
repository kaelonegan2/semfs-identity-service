# Runtime Compatibility

Role: `runtime-compatibility`.

This directory defines what a compatible runtime must provide for the seed identity. It does not contain runtime implementation code.

## Minimum Compatible Runtime

A seed-compatible runtime must be able to:

- read this identity repo
- compile `contract`
- compile common `prep`
- route by `decision.routing.next`
- validate structured outputs
- hydrate seed facets into a runtime contract
- write safe repo and conversation artifacts
- retrieve and upsert SemFS/vector summaries through policy
- emit usage events
- create human review packets
- capture owner approvals
- record capability gaps
- draft inactive capability proposals
- enforce trust, authority, approval, and side-effect boundaries

## Optional Enhanced Runtime

An enhanced runtime may provide public research, source quality checks, survey ingest, temporary review sites, and credential/payment binding requests. These remain approval-gated where they create authority or external side effects.

## Mature Runtime

A mature runtime may later support live external messaging, scheduling, payment, CRM or system-of-record writes, public site publishing, and advanced specialists. Those capabilities are not active in seed mode.
