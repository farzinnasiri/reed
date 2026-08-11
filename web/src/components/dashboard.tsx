'use client';

import { useQuery } from 'convex/react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LoopMark } from './loop-mark';

const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_WINDOW_END = Date.now() + 1;
const DASHBOARD_WINDOW = { windowEndAt: DASHBOARD_WINDOW_END, windowStartAt: DASHBOARD_WINDOW_END - 28 * DAY_MS };

export function Dashboard() {
  const viewer = useQuery(api.profiles.viewer, {});
  const insight = useQuery(api.profileInsight.getCurrent, {});
  const consistency = useQuery(api.trainingKnowledge.getConsistency, {});
  const progress = useQuery(api.trainingKnowledge.summarizeWindow, DASHBOARD_WINDOW);
  const goals = useQuery(api.trainingTargets.list, { includeArchived: false });
  const history = useQuery(api.workout.sessions.listEndedSummaries, { limit: 4 });
  const activeGoals = goals?.filter(goal => goal.status === 'active') ?? [];

  return (
    <div className="page-stack">
      <header className="page-header dashboard-header">
        <div><p className="eyebrow">Overview</p><h1>Good to see you, {viewer?.displayName ?? 'there'}.</h1><p>Your web view is for reflection, planning, and coaching. Session logging stays on mobile.</p></div>
        <Link className="button button-primary" href="/app/chat">Talk to Reed</Link>
      </header>

      <section className="dashboard-grid">
        <article className="panel insight-panel">
          <div className="panel-kicker"><LoopMark size="small" expression="listening" /><span>Reed’s read</span></div>
          <p className="insight-copy">{insight?.status === 'active' && insight.content ? insight.content : 'Reed is gathering enough signal to give you a useful read.'}</p>
          <Link className="text-link" href="/app/chat">Open the conversation →</Link>
        </article>
        <article className="panel metrics-panel">
          <Metric label="Logged work · 28 days" value={progress ? String(progress.activityCount) : '—'} />
          <Metric label="Active days · this week" value={consistency ? String(consistency.currentWeek.activeDays) : '—'} />
          <Metric label="Active goals" value={goals ? String(activeGoals.length) : '—'} />
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="section-heading"><div><p className="eyebrow">Rhythm</p><h2>{consistency?.summaryLine ?? 'Your consistency is loading.'}</h2></div><span className="quiet-number">{consistency?.recentOnTargetRate.percent ?? 0}%</span></div>
          <p className="muted">{consistency?.subline ?? 'Reed checks weekly rhythm rather than fragile daily streaks.'}</p>
          <ConsistencyGrid weeks={consistency?.weekGrid?.slice(-8) ?? []} />
        </article>
        <article className="panel">
          <div className="section-heading"><div><p className="eyebrow">Goals</p><h2>{activeGoals.length ? 'What you’re aiming at' : 'No active goal yet'}</h2></div><Link className="text-link" href="/app/goals">Manage</Link></div>
          <div className="list-stack">{activeGoals.slice(0, 3).map(goal => <GoalPreview goal={goal} key={goal._id} />)}{!activeGoals.length ? <p className="empty-copy">Create a measurable target and Reed will connect it to your logged work.</p> : null}</div>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Recent training</p><h2>A read-only record from mobile</h2></div><Link className="text-link" href="/app/training">See history</Link></div>
        <div className="session-row-list">{history?.summaries.map(session => <SessionPreview key={session.sessionId} session={session} />)}{history && history.summaries.length === 0 ? <p className="empty-copy">Completed mobile sessions will appear here.</p> : null}</div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div>; }
function ConsistencyGrid({ weeks }: { weeks: Array<{ weekStartAt: number; days: Array<{ active: boolean; isFuture: boolean }> }> }) { return <div className="consistency-grid">{weeks.map(week => <div className="consistency-week" key={week.weekStartAt}>{week.days.map((day, index) => <i className={day.isFuture ? 'future' : day.active ? 'active' : ''} key={index} />)}</div>)}</div>; }
function GoalPreview({ goal }: { goal: { _id: string; title: string; progressSummary: { current: number; required: number; currentLabel: string }; endsAt: number } }) { const ratio = goal.progressSummary.required > 0 ? Math.min(1, goal.progressSummary.current / goal.progressSummary.required) : 0; return <div className="goal-preview"><div><strong>{goal.title}</strong><span>Due {formatDate(goal.endsAt)}</span></div><div className="progress-track"><i style={{ width: `${ratio * 100}%` }} /></div><small>{goal.progressSummary.currentLabel}</small></div>; }
function SessionPreview({ session }: { session: { sessionId: string; startedAt: number; exerciseCount: number; exercises: Array<{ exerciseName: string }> } }) { return <div className="session-preview"><time>{formatDate(session.startedAt)}</time><strong>{session.exercises.slice(0, 3).map(item => item.exerciseName).join(', ') || 'Training session'}</strong><span>{session.exerciseCount} exercise{session.exerciseCount === 1 ? '' : 's'}</span></div>; }
function formatDate(value: number) { return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(value); }
