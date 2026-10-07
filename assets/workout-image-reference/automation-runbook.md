# Workout Image Batch Automation Runbook

Run every automation cycle from `/Users/farzin/MyProjects/reed`.

Goal per cycle: produce exactly 10 newly QA-approved workout images. Do not stop
until 10 images pass QA and the CSV has been updated for those 10 rows.

Source of truth:
- CSV: `exports/workout_image_prompt_data.csv`
- Prompt template: `assets/workout-image-reference/prompt-template.md`
- Reference images: `assets/workout-image-reference/reference-front-rack-hold.png` and `assets/workout-image-reference/reference-snatch-pull.png`
- Final image output directory: `assets/workout-images/`
- Metadata directory: `assets/workout-image-metadata/`

Selection:
1. Read the CSV.
2. Select the next 10 rows where `image_status` is not `complete`.
3. First consume flagged 20/80 rows: `image_priority=priority_20_80`,
   ordered by numeric `image_priority_rank`.
4. After no flagged rows remain, prioritize common gym exercises before niche
   movements using these signals:
   barbell, dumbbell, cable, machine, bench, squat, deadlift, row, press, pull-up,
   chin-up, pulldown, lunge, curl, pushdown, leg press, leg extension, leg curl,
   calf raise, fly, raise, crunch, plank.
5. Do not write persistent assignment files. Keep selected exercise IDs in the
   run context only.

Generation:
1. Spawn exactly 5 generation subagents when subagents are available.
2. Give each generation subagent exactly 2 exercises.
3. Each subagent must generate one image, immediately copy it to
   `assets/workout-images/<exercise_id>.png`, run `sips -z 1920 1080`, verify
   `1080x1920`, then stop.
4. Subagents must not edit the CSV.
5. Do not allow subagents to batch-generate several images before copying; this
   caused generated-image cache ambiguity in the first batch.
6. If a generation fails QA, regenerate only that exercise with the minimum
   worker count needed.

QA:
1. Spawn up to 5 independent QA subagents after the 10 files exist when
   subagents are available.
2. Give each QA subagent exactly 2 PNGs to inspect. Do not write persistent QA
   report files unless a blocker must be preserved for the next run.
3. QA criteria:
   - exact `1080x1920`
   - one figure
   - one movement
   - no text, panels, watermark, labels, or sequence
   - pure white background
   - reference anatomy style
   - posture clearly communicates the exercise
   - equipment and grip are accurate
   - red/orange target muscles match the exercise row
   - no cropped body parts or equipment
4. Any `fail` image must be regenerated using the failure notes, then re-QAed.
5. Continue regenerate/re-QA loops until all 10 selected rows pass QA. If a row
   fails twice, keep the slot but change the prompt based on the underlying
   failure class rather than by copying prior ad hoc wording. Focus prompt
   changes on root causes such as:
   - object count ambiguity
   - missing environment cue needed to identify the exercise
   - wrong movement phase or pose
   - incomplete equipment visibility or cropping risk
   - anatomy style or target-muscle emphasis drift
   Do not finish the automation with fewer than 10 completed rows unless image
   generation itself is unavailable.

Token and time discipline:
- Keep subagent prompts short: exercise name, target muscles, equipment, output
  path, and the required reference style.
- Do not ask subagents for long explanations. They should return only
  `pass/fail`, output path, and one-line notes.
- For retries, use the minimum number of workers needed.
- Do not create narrative run logs, assignment JSON, QA JSON, or failure-report
  artifacts for successful runs.

CSV update:
Only after QA pass, update each selected CSV row:
- `image_status=complete`
- `image_path=assets/workout-images/<exercise_id>.png`
- `image_review_notes=<short QA summary>`

Directory hygiene:
- `assets/workout-images/` must contain only final `.png` images.
- Keep `assets/workout-image-metadata/` empty for successful runs. If a run is
  genuinely blocked, write at most one compact blocker file and remove stale
  files from previous runs.

Final automation output:
- Report how many images were selected, generated, QA-passed, regenerated, and
  marked complete.
- Report any blocked rows if an image cannot be generated after repeated
  attempts.
