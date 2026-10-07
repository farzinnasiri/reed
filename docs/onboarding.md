# Onboarding

Onboarding is the main Reed app’s signup flow. The old wizard, direction screen, legacy save/update APIs and temporary migration endpoints are removed. Existing `/onboarding-v2` bookmarks redirect to `/`. The same Expo app handles onboarding on native and web.

`trainingProfiles.onboarding` stores practices and experience levels, ordered motivations, consent, body basics and visual shape, discomfort region IDs and severity, recovery, week availability, coaching rhythm, push and optional coach notes. There is no stored practice aim. Availability determines the starting support dose; available days are not promised sessions. Equipment is not collected, so planning must clarify it before selecting exercises requiring equipment.

`profiles.onboardingVersion === ONBOARDING_SCHEMA_VERSION` plus its completion timestamp unlocks the app. The stored revision remains 2; it is an internal data revision, not a second product flow. Saves are authenticated, validated and transactional. A failed save retains the draft for retry. The You sheet opens focused profile editors with Save and Cancel, reusing the answer controls without the onboarding navigator or letter. `onboarding.updateField` merges only the edited field into current answers and preserves newer body measurements. Weight edits alone record a new weight measurement.

The optional coach-notes step follows the overview and precedes the letter. Users can type or transcribe a voice note, review its text, or skip it. Notes are limited to 4,000 characters, saved as text or null, editable from the overview, and included in Reed’s coaching context. The existing authenticated `/speech/transcribe` endpoint accepts `onboarding_notes` for plain transcription. UI, telemetry and reports must not log notes or audio content.

## Development migration completed — 2026-10-06

Eight non-owner development profiles previously received sample onboarding answers. The owner completed the current onboarding personally and authorized final cleanup. All nine profiles now conform to the narrowed schema. Account identities were not changed.

The bounded cleanup ran after a dry run and verification of the owner’s completion. It removed seven legacy training payloads, ten obsolete onboarding-derived measurements and 26 obsolete onboarding assessments. It replaced 68 cached journey snapshots with nine summaries derived from onboarding answers. The final schema rejects legacy fields and removed aim parameters; the migration and restart functions no longer exist.

The owner’s remaining onboarding answers were verified unchanged. All 57 workout sessions, 310 activity logs and 12 manually logged measurements were retained. Current baseline weights were retained or restored from saved answers where needed. Separately logged measurement/assessment paths remain available.

No production migration or Android build was run.
