# Capability Gaps

Role: `authoritative` seed gap ledger.

Seed mode starts with no active mature external-facing capabilities. Gaps are expected and should be recorded plainly.

## Current Seed Gaps

### Lead Or Intake Qualification

- Status: `gap_recorded`
- Blocked action: qualifying inbound leads, users, or requests without owner-approved audience, offering, intake policy, commitment boundaries, and external send authority.
- Safe default: collect context internally, draft a proposal, route commitments to human review.
- Next route: `capability_proposal`

### Service Or Offering Q&A

- Status: `gap_recorded`
- Blocked action: answering external questions as authoritative identity or business truth.
- Safe default: draft FAQ candidates pending owner review.
- Next route: `knowledge_draft`

### Estimate Or Commitment Packet Preparation

- Status: `gap_recorded`
- Blocked action: preparing pricing, proposal, scope, delivery, or commitment packets without approved offerings, pricing/commitment posture, and review policy.
- Safe default: keep all pricing and commitments non-binding and route requests to human review.
- Next route: `capability_proposal`

### Payment Capability

- Status: `gap_recorded`
- Blocked action: requesting deposits, payments, or payment setup.
- Safe default: no payment requests or payment links in seed mode.
- Next route: `capability_proposal`

### Private Audience Or Property Memory Specialist

- Status: `gap_recorded`
- Blocked action: storing and using private audience, account, customer, property, project, or preference memory.
- Safe default: no private operational memory until owner approval, privacy policy, and runtime support exist.
- Next route: `capability_proposal`
