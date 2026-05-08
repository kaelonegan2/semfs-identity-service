# Vector References

Role: `external/vector-ref`.

The seed identity is ready to use a SemFS/vector store, but no vector memory exists at initialization.

Canonical namespace definitions live in `identity_state/memory/vector-namespaces.json`.
When the compatible runtime uses local durable memory, private/vector summaries live under `.memory/`, which is ignored by this seed repo and must not be committed.

URI pattern:

`semfs://vector/solo-identity-seed/{namespace}/{record_or_index_id}`

The repo stores stable guidance and owner-approved profile facts. Private, high-volume, personal, or changing context belongs in vector memory only after policy allows it.
