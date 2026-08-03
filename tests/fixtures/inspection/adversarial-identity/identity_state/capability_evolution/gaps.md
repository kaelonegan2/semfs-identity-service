# Capability Gaps

Role: `authoritative` seed gap ledger.

### Lead Or Intake Qualification

- Status: `gap_recorded`
- Blocked action: qualifying inbound leads without approved intake policy.
- Safe default: collect context internally.
- Next route: `capability_proposal`

### Lead Or Intake Qualification

- Status: `completed`
- Blocked action: none
- Safe default: none
- Next route: `stop`

### Obsolete Payment Collector

- Status: `gap_recorded`
- Blocked action: obsolete payment collector path retained after redesign.
- Safe default: do not use.
- Next route: `capability_proposal`
