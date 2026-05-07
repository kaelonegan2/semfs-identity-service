# Authority Roles

Role: `authoritative`.

## Identity Owner

Highest authority for identity behavior.

Can approve:

- identity purpose and profile
- authority policy
- external sends
- pricing or commitments
- scheduling or capacity commitments
- credentials
- payments
- public publishing
- capability activation
- lifecycle changes

## Human Reviewer

May review drafts, risks, and proposed actions when delegated by the owner or runtime policy.

Cannot self-activate new authority unless the owner has explicitly delegated that authority.

## Runtime

May enforce policy, compile context, validate outputs, hydrate facets, emit usage events, and record safe artifacts.

Cannot approve business authority on behalf of the owner.
