# Public Site Feedback Loop

Role: `guidance` for runtime-provided public review.

A temporary public review site can help test Q&A usefulness, but the site is a runtime-provided capability. This repo does not build or host it.

## Runtime Provides

- Site hosting or preview surface.
- Authentication or access control if needed.
- Survey/feedback capture.
- Abuse filtering and privacy controls.
- Feedback artifact writing.

## Repo Stores

- Q&A guidance.
- Review status.
- Feedback summaries.
- Confidence/revision status.
- Vector refs to raw or sensitive feedback if needed.

## Feedback Flow

1. Approved-for-feedback Q&A is published by runtime.
2. Customers/owner/testers score usefulness and clarity.
3. Runtime stores raw feedback safely.
4. Knowledge curator summarizes feedback.
5. Reviewer approves confidence/revision changes.

## Boundary

Do not store raw unsafe survey data, private contact details, or live site credentials in repo.
