## What to build

The table storing auth identity (email, name, avatar) is called `profiles`. Consider renaming to `users` to match the universal mental model. `trainingProfiles` would then become `trainingProfiles` with `userId`.

## Acceptance criteria

- [ ] Decide: keep `profiles` or rename to `users`
- [ ] If rename, plan migration for `trainingProfiles.profileId` foreign key
- [ ] Document decision in `CONTEXT.md`

## Blocked by

None - can start immediately

Status: needs-triage
