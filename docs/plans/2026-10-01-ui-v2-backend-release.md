# UI v2 backend production release

Prepared 2026-10-01 for BE-1–BE-10 and brief E. **Production has not been queried, changed or deployed by this work.** These commands are for the later, explicitly authorised production operator. Dev results are in the migration plan's handoff log; they are not production evidence.

## 1. Prepare reviewed release artifacts

1. Get orchestrator acceptance of D/E and approval for the production release. Resolve or explicitly accept the remaining domain-file findings and dependency/Doctor findings in the review table below. Complete frontend timezone/clock integration QA before publishing the client.
2. Identify the current production source revision and record its deployment version. Take a production backup/export through the existing Convex operations process. Keep it outside the repository; it contains private app data. Confirm restore access before deploying.
3. Prepare two isolated, reviewed artifacts. Do not deploy this working directory: it contains unrelated changes. `REED_SCHEMA_RELEASE_DIR` holds current production behavior with only the widened schema and its validator dependencies. `REED_BACKEND_RELEASE_DIR` holds the final approved backend, shared domain changes from C, dependencies and tests. These are operator-provided absolute paths, not artifacts created by this task.
4. The schema artifact must add optional `profiles.timeZone`, optional `trainingProfiles.trainingReality.weeklyActiveDaysTarget` (literal integers 1–7), optional `reedMessages.widget`/`replies`, and the reference-only widget validator. Preserve `relatedSessionId` wherever already deployed, or widen it too if absent. Include indexes used by the new readers: `trainingTargets.by_profile_id_and_status_and_updated_at`, `activityLogs.by_profile_id_and_source_and_logged_at`, and `quickLogPresets.by_enabled_and_sort_order`; preserve existing indexes. Check the approved final schema to avoid missing an index or including unrelated catalog changes. Do not narrow/remove anything.
5. Preserve all existing production fields, functions, auth configuration and secrets in the schema artifact. If existing profile return validators are shared into that artifact, widen them for optional `timeZone` too. Do not run backfills or publish new clients during this stage.
6. Run the final artifact's checks against dev first: locked install, root typecheck, doctor, tests, Convex codegen/backend typecheck and dev push. Brief E passed the requested codegen/dev push/tests/root typecheck; Doctor failed the Hermes regression check (21/22 passed). Repeat against the actual assembled release artifact, since this task did not assemble or deploy it. A passed backend test suite does not resolve that native SDK finding.

Use the production environment file already configured by the operator. Do not print/read it or put credentials in commands, reports or git. Set `REED_PROD_ENV_FILE` to its absolute path. Confirm that the deploy target is the intended Reed production deployment, not a preview, self-hosted or dev target, using the deployment preview and dashboard.

## 2. Deploy widened schema, then backend code

Convex has no schema-only switch here: a deploy publishes the artifact's schema and functions together. The first artifact therefore keeps old behavior while widening validation; the second turns on the new behavior. A successful first deploy is the ordering barrier.

```sh
cd "$REED_SCHEMA_RELEASE_DIR"
npm ci
npm run convex:deploy -- --dry-run --env-file "$REED_PROD_ENV_FILE" --typecheck enable
npm run convex:deploy -- --env-file "$REED_PROD_ENV_FILE" --typecheck enable --message 'UI v2: widen backend schema'
```

Wait for schema validation/index readiness and successful deployment. If validation fails, stop and inspect the incompatible field; do not delete documents or disable validation to continue. Confirm old-client profile/thread reads still work before the second stage.

```sh
cd "$REED_BACKEND_RELEASE_DIR"
npm ci
npm run typecheck
npm test
npm run convex:deploy -- --dry-run --env-file "$REED_PROD_ENV_FILE" --typecheck enable
npm run convex:deploy -- --env-file "$REED_PROD_ENV_FILE" --typecheck enable --message 'UI v2: backend BE-1 through BE-10 and hardening'
```

Keep new clients unpublished until the backend is ready. No database prompt publication is needed: widget guidance is the checked-in `REED_PRESENTATION_PROMPT`, version `reed-widgets-v1`, added to the existing single-generation output contract. Do not overwrite active coaching prompt rows. The xAI default and existing Google/OpenAI routes need their existing deployment credentials; do not rotate auth/model keys as part of this release.

## 3. Run both backfills, in order

After the backend deploy succeeds, run BE-8 first and BE-10 second. Each internal mutation accepts `{ "cursor": null }`, returns `{ cursor, isDone, scanned, updated }`, and reads at most 100 parent documents per page. Pass the returned cursor unchanged until `isDone`; never invent or reuse a cursor from another function. Each page commits atomically. On interruption, record the last completed cursor and resume at that cursor; restarting at `null` is also safe.

First-page commands, with automatic pushing/codegen disabled:

```sh
npx convex run --prod --env-file "$REED_PROD_ENV_FILE" --codegen disable trainingProfileMigrations:backfillWeeklyActiveDaysTarget '{"cursor":null}'
npx convex run --prod --env-file "$REED_PROD_ENV_FILE" --codegen disable profileTimeZoneMigrations:backfillProfileTimeZone '{"cursor":null}'
```

Do not stop at the first page unless `isDone` is true. For complete paging without hand-copying JSON, run the following **instead of** the two first-page commands. It runs each migration to completion twice, verifies that the repeat updates zero, and prints only migration counters/cursors. It pauses between pages so the operator can inspect scheduled-function health and avoid building a journey/insight queue backlog.

```sh
python3 - <<'PY'
import json, os, subprocess
base = ['npx', 'convex', 'run', '--prod', '--env-file', os.environ['REED_PROD_ENV_FILE'], '--codegen', 'disable']
names = ['trainingProfileMigrations:backfillWeeklyActiveDaysTarget', 'profileTimeZoneMigrations:backfillProfileTimeZone']
for name in names:
    for attempt in range(2):
        cursor = None
        scanned = updated = 0
        for page_number in range(1, 10001):
            result = subprocess.run(base + [name, json.dumps({'cursor': cursor})], capture_output=True, text=True)
            if result.returncode:
                raise SystemExit(f'{name} failed; last completed cursor: {cursor!r}. Inspect deployment logs before resuming.')
            page = json.loads(result.stdout)
            scanned += page['scanned']; updated += page['updated']
            print(json.dumps({'function': name, 'repeat': bool(attempt), 'page': page_number, **page}), flush=True)
            if page['isDone']:
                break
            cursor = page['cursor']
            input('Inspect scheduled-function health; press Enter to continue this migration: ')
        else:
            raise SystemExit(f'Page bound reached; resume {name} from cursor {cursor!r}.')
        if attempt and updated:
            raise SystemExit(f'{name} repeat updated {updated}; investigate newly eligible records or a migration defect.')
        print(json.dumps({'function': name, 'repeat': bool(attempt), 'scanned': scanned, 'updated': updated}))
PY
```

Export `REED_PROD_ENV_FILE` before this Python command. This script is documentation, not an installed migration service.

- **BE-8:** fills only absent exact goals, using `one_to_two → 2`, `two_to_four → 3`, `four_plus → 4`. Existing exact choices, timestamps and other training-profile fields stay unchanged. Unknown categories stay unfilled. Each changed row schedules the existing journey rebuild and profile-insight invalidation; wait for these jobs and inspect failures before client publication. Journey evidence is bounded; cap notices must not be mistaken for exact historical totals.
- **BE-10:** fills only absent profile zones from valid legacy notification preference zones, canonicalising IANA aliases. Existing profile zones, all other fields/timestamps and preference rows stay unchanged. Missing/invalid legacy zones stay absent and resolve to UTC until a client syncs. Do not bulk invent UTC values. This backfill schedules no cache work because it preserves the effective calendar.
- There is no widget/reply or historical-message backfill. Old messages remain field-absent. Historical Activity Log timestamps and old journey snapshots are retained. These migrations do not migrate auth ownership or delete legacy profiles.

## 4. Verify before publishing the client

Use a normal authenticated production QA account approved for this release. Do not reuse development credentials, bypass Clerk/Convex auth, or log tokens, names, health data, prompts or whole messages. Query with the app's token-wired Convex client; CLI `--identity` impersonation would not prove the actual JWT integration.

| Query/mutation and arguments | Expected evidence |
|:--|:--|
| `profiles.viewer({})`; `profiles.updateTimeZone({ timeZone: deviceZone })` twice | Zone from `Intl.DateTimeFormat().resolvedOptions().timeZone` is stored; second call leaves `updatedAt` unchanged. Notification preferences need not exist. Invalid IANA name rejected. |
| `home.getPulse({ now })`; `trainingKnowledge.getConsistency({ now })`; `profileConsistency.viewerConsistency({ now })` | `now = Math.floor(Date.now() / 300000) * 300000`. Pulse day flags/count and exact target match current Consistency; both Consistency responses match. Current-week timestamps format as local Monday through next Monday. |
| Both Consistency queries with `{}` | Old clients still receive the same shape, including optional/additive fields. Omitted clock uses server time, so this alone does not prove midnight subscription refresh. |
| `home.getTodayCards({ now })` | Deterministic weigh-in/recovery rules, bounded preset keys; cards can correctly be absent. Verify normal morning/noon behavior on a test account rather than faking timestamps beyond the 36-hour guard. |
| `liveSessions.getActiveStatus({})` | `null` when no session; otherwise owned exercise name/next set or nullable unknown count above 2,000 selected-exercise logs. Foreign selection cannot leak another user's exercise. |
| `reed.listMessagesPaginated({ paginationOpts: { cursor: null, numItems: 20 } })`; continue returned cursors | Valid return shape, owned related-session summaries, old messages readable, reference-only widget/replies when present. Page cap is 50; at most five attachments per message. |
| `reed.listMessages({ limit: 40 })`; `reed.listQuickActions({})` | Compatibility list works; quick actions require auth. Signed-out calls to home, Consistency, status, thread reads, quick actions and timezone mutation reject. |
| `notificationPreferences.viewerPreferences({})` | Existing preferences expose the profile zone; absent preferences remain `null`. Settings toggles do not rewrite the profile zone unless the old caller explicitly sends one. |

With the operator's deployment access, inspect only the approved QA profile's `reedJourney.latestForProfile({ profileId })`, `profileInsightData.snapshot({ profileId })` and `coachOutreachData.snapshot({ profileId })` results privately. Verify the exact goal in the rebuilt baseline, local current-week start/active days and resolved timezone. Do not paste their complete results into a release report. Confirm no failed migration-triggered scheduler jobs.

For a production widget smoke test, get authorisation to send one normal QA chat request or use the approved non-production rehearsal. Check text usability, owned ended-session references, filtered preset keys and at most three short reply chips. In Langfuse verify `reed.chat.model` metadata (`outputContract`, `modelProvider`) and `reed.chat.presentation` (`widgetKind`, `replyCount`, `outputContract`). The model parameters must reflect provider-supported settings. Malformed metadata/no model key degrades to usable text; a telemetry failure must not fail a stored reply. Do not trigger real outreach/push delivery solely to test this release.

Only after these checks, publish the reviewed client and exercise mount/foreground timezone sync, five-minute clock refresh, notification-independent sync, profile edits carrying an exact goal, and Android flows. Repeat an older-client smoke test during rollout.

## 5. Compatibility, narrowing and rollback

| Contract | Rollout rule / later cleanup |
|:--|:--|
| `home.getPulse/getTodayCards.now` | Required from their introduction; retain 36-hour/non-finite fallback. Clients must refresh every five minutes and on foreground. |
| Both Consistency queries' `now` | Optional during older-client support. Make required only after every supported caller supplies the clock and old releases are retired, with an approved API change. Remove the legacy module shim only after it has no supported callers. |
| Profile `timeZone`, training-profile exact goal | Schema stays optional: backfills cannot fill missing/invalid legacy zones or unknown cadence, and old clients remain valid. Require the exact goal in profile-write args only after supported clients always send it. Require a stored zone only after onboarding/profile creation initializes it and all missing data is reconciled; do not require it merely because the notification backfill finished. |
| `weeklyActiveDaysTarget` write fallback | Same-category old saves preserve an existing choice; changed-category old saves use the new category default. Keep while old clients can write. Retire this fallback only with an approved required-goal contract. |
| Notification `timeZone` | Legacy fallback only. After all eligible profiles migrate and old setter callers retire, remove that argument, then clean legacy stored fields in bounded pages, then narrow the preference schema. Until then `null` clears fallback only, never the profile. |
| Reed `clientTimeZone` | Accepted for compatibility, but the profile resolver wins. Remove only after all supported callers stop sending it. Existing/explicit goal calendars remain goal-owned. |
| Message `widget`/`replies` | Stay optional indefinitely for old and legitimately text-only replies; making them required is incorrect. No speculative `plan`/Actor widget schema is shipped. |

On deploy/backfill/check failure, stop client publication and later migration pages. Keep the widened schema and additive indexes. Prefer a fix forward; if restoring prior logic, deploy a reviewed compatibility artifact that retains the widened validators, new endpoints/optional args used by published clients, and profile timezone/exact-goal reads. A raw pre-migration deploy can reject backfilled documents or break the new client.

Do not delete backfilled fields on rollback: users may already have changed those values. Disabling optional widget generation can return text-only while preserving stored metadata and old messages. Keep schema/endpoint compatibility even if a client rollout is paused. A whole-database restore can discard unrelated post-backup writes and needs separate incident approval; it is not an automatic migration rollback. Do not remove additive indexes until no deployed readers need them.

## 6. Hardening findings and decisions

| ID | Finding | Fix or deliberate decision |
|:--|:--|:--|
| E-01 | Session-wide 2,000-log sample could hide selected-exercise sets. | Query the selected exercise's index, read 2,001, return nullable unknown above 2,000 rather than a wrong count or a volume exception. Ownership/fallback and dense-session tests added. |
| E-02 | Offset iteration picked yesterday for São Paulo's missing midnight; midnight quiet hours could format `24:xx`. | Shared day bounds verify the first date instant and use a bounded search only for gaps/folds/skipped dates; quiet hours use `h23`. São Paulo, Cairo, Havana and Apia regressions added. |
| E-03 | Quick actions lacked auth despite being product content. | Require the viewer profile. Tests cover unauthenticated rejection across migration public paths. Existing secret-authenticated prompt administration was not redesigned; it predates and is outside this migration. |
| E-04 | Changed Consistency and message-list functions lacked explicit return validation. | Both Consistency queries share a structural return validator; message lists derive stored fields/attachment types from the schema and validate pagination extras, avoiding another message schema copy. |
| E-05 | Client-supplied message page size and attachment `collect()` reads could exceed transaction limits. | Clamp pages to 1–50; retain platform cursors/split metadata. Attachment reads cap at five, count checks at six. Compatibility limit is finite/integer-clamped with existing default 40/max 200. These limits are explicit contract callouts. |
| E-06 | Internal completion could patch a user message or a mismatched profile/thread; failure had no role guard. | Validate assistant role and thread/profile linkage before completion; require assistant role before failure. Registered-handler tests prove text survives invalid metadata and failure clears valid widget/chips. |
| E-07 | BE-8/10 now trigger inherited unbounded journey scans; catalog sampling could omit exercised IDs. | Bound recent sessions/logs/body/record evidence, load referenced catalog IDs, and disclose truncation in stored rendered context. Limits: sessions 100, trajectory logs 1,000, current logs 500, body points 200, record logs 2,000, each with a one-row overflow probe. Weekly Consistency remains exact. Dense-journey regression added. |
| E-08 | Three duplicated timezone normalisers, duplicated range type and unused calendar re-exports. | Reuse `localCalendar.normalizeTimeZone`, canonical `ReedTimeRange`, and direct timezone resolver imports; remove dead re-exports. Keep shared selection/set-number helpers: capture and status use them to prevent divergent semantics. |
| E-09 | Langfuse always reported temperature/reasoning even when the provider factory omitted them. | Generation trace now uses `supportedModelSettings` and the same reasoning selection as the model. Existing output-contract and stored presentation metadata retained; tracing failure remains isolated. |
| E-10 | Critical handler paths had only pure-helper coverage. | Add registered-handler tests for auth, dense/foreign live selection, page/attachment bounds, completion/failure and bounded journey rebuilding; extend shared calendar/notification regressions. Retain the accepted Node/tsx test setup to stay within backend/test ownership; no testing dependencies added. |
| L-01 | Bounded Pulse/Consistency/related-session summaries intentionally do not read all history. | Retain accepted 100 active-goal sample, 128 per-day counts with cap flag and exact active days, 100 related-session exercises, 100 presets/200 quick-log usage. Related exercise counts are sampled above 100; adding a counter/contract is a later separately reviewed change. |
| L-02 | Convex validators cannot encode IANA membership, finiteness or array/string length caps. | Structural schemas and literal 1–7 goals remain strict where expressible; authenticated write guards/sanitisation enforce the remaining constraints. Internal `v.any()` metadata is intentional so malformed optional model fields cannot reject good prose. Public callers cannot invoke those internal writers. |
| L-03 | Optional fields/old args and UTC fallback remain. | Preserve compatibility as detailed above. Do not fabricate profile zones, remove legacy auth profiles or require widget metadata. Existing target calendars and elapsed-hour lookback/review intervals retain their domain meaning. |
| L-04 | `domains/trainingKnowledge/reedContextRepository.ts` still collects session exercises for up to 12 sessions; `domains/goals/target-evaluation.ts` has its own local-calendar implementation. | Both are outside E's explicit `convex/`/backend-test ownership. No indirect duplicate repository or goal-math rewrite was added. Orchestrator must assign a bounded session-exercise follow-up and review goal calendar parity before claiming all backend calendar/volume paths satisfy the global rule. |
| L-05 | Other unchanged training/workout queries have legacy `collect()` paths; related-session queries assume stored ownership integrity. | Reviewed the migration changes, not a repository-wide rewrite. New/changed public paths derive the viewer, and related-session/widget reads enforce ownership. Broader legacy query hardening remains a separately scoped task; this release is not a proof of all repository paths or worst-case document-byte limits. |
| L-06 | Locked dependencies report a critical transitive `shell-quote` advisory; Expo Doctor fails the Hermes regression check for the installed SDK. | Fresh npm audit reported 36 findings (1 low, 21 moderate, 13 high, 1 critical); this is an audit result, not evidence of an exploitable Reed runtime path. Doctor passed 21/22 checks. Dependency manifests and SDK upgrades are outside E ownership; no `audit fix` or upgrade was run. Assign dependency/native owners to triage these before release approval. |

Production execution, production JWT integration, provider/Langfuse UI inspection, browser/Android client flows and adversarial byte-size load tests are unverified by brief E. The remaining domain-path decisions are release review gates, not completed fixes.
