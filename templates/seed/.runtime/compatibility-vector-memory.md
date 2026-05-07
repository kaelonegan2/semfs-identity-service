# Vector Memory Compatibility

Role: `runtime-compatibility`.

A compatible runtime must understand seed namespace references without treating vector memory as repo truth or copying raw records into runtime contracts.

Seed vector memory begins empty. Retrieval and upsert are policy-governed and summary-only unless an approved future capability permits more.

Runtime contracts may include vector summaries and references. They must not include raw transcripts, private records, payment data, credential details, or verification evidence.
