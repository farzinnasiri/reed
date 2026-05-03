## What to build

"Recipe" is a backend abstraction for "which input fields an exercise uses." It appears in schema fields (`recipeKey`, `rawMetricRecipe`) but should never be user-facing. Audit whether it has leaked into component names or UI copy.

## Acceptance criteria

- [ ] Audit codebase for "recipe" in user-facing strings, component names, or prop names
- [ ] Decide if "recipe" should be renamed to "metricSchema" or similar
- [ ] Create follow-up issue if renames needed

## Blocked by

None - can start immediately

Status: needs-triage
