## What to build

Make the Profile `Consistency` module stay trustworthy when the user's cadence target or history changes. This slice should close the obvious seams so the module does not silently mislead users after onboarding edits, during partial weeks, or when the available history is too thin for a confident read.

## Acceptance criteria

- [ ] Define and implement v1 behavior when the user changes their weekly cadence target in Profile.
- [ ] The module handles partial current weeks, brand-new users, and sparse history without broken or misleading summaries.
- [ ] The grid and summary stay internally consistent after target edits and profile refreshes.
- [ ] Any deferred edge cases are explicitly listed so future work does not rediscover them accidentally.

## Blocked by

- [.scratch/profile-consistency/issues/03-add-consistency-module-to-profile.md](/Users/farzin/MyProjects/reed/.scratch/profile-consistency/issues/03-add-consistency-module-to-profile.md)

Status: needs-triage
