// ---------------------------------------------------------------------------
// review-summary.ts — deterministic profile → prose.
// Converts structured draft fields into human-readable review sections.
// No AI. Label maps + rule-based composition per PRD v1.
// ---------------------------------------------------------------------------

import { emptyGoalDetail, type OnboardingDraft, type OnboardingBaseStep } from './types';

export type ReviewSection = {
  heading: string;
  body: string;
  /** Step to jump to when the user taps "Edit" on this section. */
  editStep?: OnboardingBaseStep;
};

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

import {
  DURATION_PROSE_LABELS,
  EFFORT_PROSE_LABELS,
  FOCUS_PROSE_LABELS,
  GOAL_DETAIL_PROSE_LABELS,
  GOAL_PROSE_LABELS,
  PAIN_PROSE_LABELS,
  RECOVERY_PROSE_LABELS,
  WEEKLY_PROSE_LABELS,
} from './labels';

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildPrioritySummary(draft: OnboardingDraft): string {
  if (draft.rankedGoals.length === 0) return 'No goals ranked yet.';

  const parts: string[] = [];
  const topGoalId = draft.rankedGoals[0];
  const topGoalLabel = GOAL_PROSE_LABELS[topGoalId] ?? topGoalId;
  const topDetail = draft.goalDetails[topGoalId] ?? emptyGoalDetail();

  // Detail text resolution: Use customDetail if 'other', else map, else raw value
  let detailText = null;
  if (topDetail.detail === 'other' && topDetail.customDetail) {
    detailText = topDetail.customDetail.trim() || 'custom goal';
  } else if (topDetail.detail) {
    detailText = GOAL_DETAIL_PROSE_LABELS[topDetail.detail] ?? topDetail.detail;
  }

  let goalPhrase = detailText ? `${detailText} — ${topGoalLabel}` : topGoalLabel;
  parts.push(`${capitalize(goalPhrase)} is the top priority for this block.`);

  if (draft.rankedGoals.length > 1) {
    const rest = draft.rankedGoals.slice(1).map(g => GOAL_PROSE_LABELS[g] ?? g).join(' and ');
    parts.push(`${capitalize(rest)} ${draft.rankedGoals.length === 2 ? 'runs' : 'run'} alongside.`);
  }

  if (topDetail.focusAreas && topDetail.focusAreas.length > 0) {
    const areas = topDetail.focusAreas.map(a => {
      if (a === 'other' && topDetail.customDetail) {
        return topDetail.customDetail.trim() || 'custom';
      }
      return GOAL_DETAIL_PROSE_LABELS[a] ?? FOCUS_PROSE_LABELS[a] ?? a;
    });
    parts.push(`Focus: ${areas.join(', ')}.`);
  }

  return parts.join(' ');
}

function buildBudgetSummary(draft: OnboardingDraft): string {
  const parts: string[] = [];

  if (draft.weeklySessions) parts.push(WEEKLY_PROSE_LABELS[draft.weeklySessions]);
  if (draft.sessionDuration) parts.push(`usually ${DURATION_PROSE_LABELS[draft.sessionDuration]}`);
  if (draft.effort) parts.push(`with ${EFFORT_PROSE_LABELS[draft.effort]} already normal`);

  return parts.length > 0
    ? capitalize(parts.join(', ')) + '.'
    : 'Training budget not yet specified.';
}

const BODY_TYPE_PROSE_LABELS: Record<NonNullable<OnboardingDraft['bodyType']>, string> = {
  athletic: 'athletic',
  bulky: 'bulky',
  high_fat: 'higher body fat',
  skinny: 'skinny',
  skinny_fat: 'skinny-fat',
};

const GENDER_PROSE_LABELS: Record<NonNullable<OnboardingDraft['genderIdentity']>, string> = {
  female: 'female',
  male: 'male',
  nonbinary: 'non-binary',
  prefer_not_to_say: 'prefer not to say',
};

function buildStartingPointSummary(draft: OnboardingDraft): string {
  const parts: string[] = [];
  if (draft.bodyType) parts.push(`body type: ${BODY_TYPE_PROSE_LABELS[draft.bodyType]}`);
  if (draft.genderIdentity) parts.push(`gender: ${GENDER_PROSE_LABELS[draft.genderIdentity]}`);
  return parts.length > 0 ? `Starting point — ${parts.join('; ')}.` : 'No starting point context selected.';
}

const DAILY_MOVEMENT_PROSE_LABELS: Record<NonNullable<OnboardingDraft['dailyMovement']>, string> = {
  mostly_sitting: 'mostly sitting',
  on_feet: 'often on your feet',
  walks_a_lot: 'out and about most days',
  physical_job: 'a physical job',
  restless: 'restless or fidgety',
};

const IDLE_MOVEMENT_PROSE_LABELS: Record<NonNullable<OnboardingDraft['idleMovement']>, string> = {
  mostly_still: 'mostly still when seated',
  fidget_sometimes: 'some fidgeting when seated',
  always_moving: 'restless or always moving',
};

const STEPS_PROSE_LABELS: Record<NonNullable<OnboardingDraft['usualSteps']>, string> = {
  not_sure: 'steps unknown',
  under_4k: 'under 4k steps',
  four_to_8k: '4-8k steps',
  eight_to_12k: '8-12k steps',
  over_12k: '12k+ steps',
};

const EATING_ROUTINE_PROSE_LABELS: Record<NonNullable<OnboardingDraft['eatingRoutine']>, string> = {
  consistent: 'consistent eating routine',
  hit_or_miss: 'hit-or-miss eating routine',
  often_under_eat: 'often under-eating',
  often_overeat: 'often over-eating',
  not_sure: 'eating routine unclear',
};

function buildLifestyleSummary(draft: OnboardingDraft): string {
  const parts = [
    draft.dailyMovement ? DAILY_MOVEMENT_PROSE_LABELS[draft.dailyMovement] : null,
    draft.usualSteps ? STEPS_PROSE_LABELS[draft.usualSteps] : null,
    draft.idleMovement ? IDLE_MOVEMENT_PROSE_LABELS[draft.idleMovement] : null,
    draft.eatingRoutine ? EATING_ROUTINE_PROSE_LABELS[draft.eatingRoutine] : null,
  ].filter(Boolean);

  return parts.length > 0 ? capitalize(parts.join('; ')) + '.' : 'No lifestyle context selected.';
}

function buildRecoverySummary(draft: OnboardingDraft): string {
  if (!draft.recoveryQuality) return 'Recovery stance not yet specified.';
  const label = RECOVERY_PROSE_LABELS[draft.recoveryQuality];

  if (draft.recoveryQuality === 'fragile') {
    return `${capitalize(label)}. I'll be conservative with failure work and avoid stacking high-fatigue days.`;
  }
  if (draft.recoveryQuality === 'mixed') {
    return `${capitalize(label)}. I'll monitor volume accumulation and adjust when energy is low.`;
  }
  return `${capitalize(label)}. Standard volume and intensity approach.`;
}

function buildConstraintsSummary(draft: OnboardingDraft): string {
  if (draft.constraintAreas.length === 0) return 'No constraints or pain areas flagged.';

  const parts = draft.constraintAreas.map(area => {
    const detail = draft.constraintDetails[area];
    let areaLabel = PAIN_PROSE_LABELS[area] ?? area;
    if (area === 'other' && detail?.customDetail) {
      areaLabel = detail.customDetail.trim() || 'custom constraint';
    }
    const severityNote = detail?.severity ? ` (${detail.severity})` : '';
    return `${areaLabel}${severityNote}`;
  });

  return `Need to respect: ${capitalize(parts.join(', '))}.`;
}

function buildActionSummary(draft: OnboardingDraft): string {
  const parts: string[] = [];
  const top = draft.rankedGoals[0] ?? null;

  if (top === 'master_skill') parts.push('Keep skill work fresh at the start of sessions.');
  else if (top === 'build_muscle') parts.push('Prioritize hypertrophy volume in compound and isolation work.');
  else if (top === 'get_stronger') parts.push('Structure sessions around main lift progression.');
  else if (top === 'support_sport') parts.push('Bias training toward sport-relevant movement patterns.');
  else if (top === 'improve_conditioning') parts.push('Build aerobic base with structured conditioning blocks.');
  else if (top === 'move_without_pain') parts.push('Focus on pain-free ranges and gradual load tolerance.');

  if (draft.recoveryQuality === 'fragile') {
    parts.push('Preserve recovery by limiting high-fatigue stacking.');
  }

  return parts.length > 0 ? parts.join(' ') : "I'll build a balanced starting program.";
}

export function buildTradeoffStatement(draft: OnboardingDraft): string {
  const top = draft.rankedGoals[0];
  if (!top) return "I'll protect the top priority when trade-offs are needed.";

  const primary = GOAL_PROSE_LABELS[top];
  const topDetail = draft.goalDetails[top];
  if (draft.rankedGoals.length > 1) {
    const secondary = GOAL_PROSE_LABELS[draft.rankedGoals[1]];
    return `I'll protect ${primary} over maximal ${secondary} volume.`;
  }

  return `I'll protect ${primary} as the top priority and adjust other work to serve it.`;
}

export function buildReviewSections(draft: OnboardingDraft): ReviewSection[] {
  return [
    { heading: 'Priority', body: buildPrioritySummary(draft), editStep: 'priorities' },
    { heading: 'Training budget', body: buildBudgetSummary(draft), editStep: 'training-reality' },
    { heading: 'Starting point', body: buildStartingPointSummary(draft), editStep: 'body-type' },
    { heading: 'Lifestyle', body: buildLifestyleSummary(draft), editStep: 'lifestyle' },
    { heading: 'Recovery', body: buildRecoverySummary(draft), editStep: 'baseline' },
    { heading: 'Constraints', body: buildConstraintsSummary(draft), editStep: 'constraints' },
    draft.userNotes.trim().length > 0
      ? { heading: 'Your note', body: draft.userNotes.trim(), editStep: 'notes' }
      : { heading: 'Your note', body: 'No extra notes added.', editStep: 'notes' },
    { heading: "What I'll do", body: buildActionSummary(draft) },
  ];
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
