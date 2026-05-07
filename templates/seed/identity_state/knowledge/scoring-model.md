# Knowledge Scoring Model

Role: `guidance` for answer review and confidence.

## Score Dimensions

- Accuracy against canonical identity files.
- Source basis quality.
- Customer usefulness.
- Authority safety.
- Privacy safety.
- Voice fit.
- Completeness.
- Need for specialist review.

## Confidence Levels

- `high`: source-backed, reviewed, low risk.
- `medium`: useful but requires caveats or more context.
- `low`: draft only, source or authority uncertainty remains.

## Reviewer Actions

- approve,
- approve with caveat,
- request revision,
- reject,
- require specialist,
- require owner policy decision.

## Writeback

Scores can update review status and confidence. Raw survey responses should be summarized safely or stored behind vector refs.
