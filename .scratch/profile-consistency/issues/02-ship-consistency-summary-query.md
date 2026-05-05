## What to build

Add the backend path for the Profile `Consistency` module so the app can ask one question and receive a trustworthy consistency summary for the current viewer. The result should include the week-level evaluation against the user's stated cadence target and the day-level activity map needed for the GitHub-style grid.

## Acceptance criteria

- [ ] A single viewer-scoped query returns the v1 consistency payload for Profile.
- [ ] The payload includes current week progress against target, recent week outcomes, current run of on-target weeks, and the day-level training map needed for the grid.
- [ ] The query uses the canonical consistency rules from issue `01-define-consistency-contract.md`.
- [ ] Empty-history and pre-target edge cases return deterministic, UI-safe results.

## Blocked by

- [.scratch/profile-consistency/issues/01-define-consistency-contract.md](/Users/farzin/MyProjects/reed/.scratch/profile-consistency/issues/01-define-consistency-contract.md)

Status: needs-triage
