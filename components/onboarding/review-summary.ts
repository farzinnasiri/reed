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
