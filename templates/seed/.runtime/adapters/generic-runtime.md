# Generic Runtime Adapter

Role: `runtime-compatibility`.

A compatible runtime may implement this seed package in any orchestration environment.

Required behavior:

- load repo refs
- compile `contract`
- compile common `prep`
- dispatch with `decision.routing.next`
- validate structured output
- hydrate facets
- enforce approval boundaries
- keep secrets outside the repo

This adapter note is intentionally provider-neutral.
