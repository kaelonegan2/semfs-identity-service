# Capability Evolution

The identity can mature, but not through uncontrolled runtime self-modification.

## Agent-Centered Evolution

When the capability changes execution behavior, model it through `identity_state/agents/lifecycle.md`.

Agent evolution states:

1. `gap_detected`
2. `candidate_agent`
3. `proposal_written`
4. `approved`
5. `activated`
6. `dispatchable`
7. `retired`

## Dispatchability Rule

An agent may run only when the canonical registry marks it active and all dependencies exist:

- prompt,
- output contract,
- facet policy,
- tool permissions,
- authority rules,
- eval coverage,
- approval artifact when required.

## Non-Agent Evolution

Tool, specialist, skill, credential, payment, model-policy, stage, vector namespace, or business-rule changes use `identity_state/capability_evolution/` plus the relevant domain folder (`security/`, `payments/`, `governance/`, `knowledge/`, or `research/`).

Owner-authorized evolution profiles are defined in `identity_state/lifecycle/evolution-profiles.*`.

## Runtime Rule

The runtime must not create arbitrary dynamic agents. It may surface a gap and write a proposal, but activation is an owner-approved repo/governance event with runtime support.
