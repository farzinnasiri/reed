import type { Doc } from './_generated/dataModel';
import { displayedGoalUnit } from '../domains/goals/target-evaluation';

export function selectNearestGoal(targets: Doc<'trainingTargets'>[]) {
  let nearest: { targetId: Doc<'trainingTargets'>['_id']; label: string; current: number; goal: number; unit: string } | null = null;
  for (const target of targets) {
    if (target.status !== 'active') continue;
    const progress = target.progressSummary;
    // Matches target-progress.tsx's overall slice, including older period summaries.
    const current = progress.overall?.current ?? (progress.totalPeriods ? progress.satisfiedPeriods ?? 0 : progress.current);
    const goal = progress.overall?.required ?? (progress.totalPeriods ?? progress.required);
    if (!Number.isFinite(current) || !Number.isFinite(goal) || current <= 0 || goal <= 0) continue;
    const unit = progress.totalPeriods || progress.overall?.label === 'Goal'
      ? target.rule.cadence === 'daily' ? 'days hit' : target.rule.cadence === 'weekly' ? 'weeks hit' : 'periods complete'
      : displayedGoalUnit(target.rule);
    if (!nearest || current / goal > nearest.current / nearest.goal) {
      nearest = { targetId: target._id, label: target.title, current, goal, unit };
    }
  }
  return nearest;
}
