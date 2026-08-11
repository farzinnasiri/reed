'use client';

import { useQuery } from 'convex/react';
import { api } from '@/lib/api';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_WINDOW_END = Date.now() + 1;
const HISTORY_WINDOW = { windowEndAt: HISTORY_WINDOW_END, windowStartAt: HISTORY_WINDOW_END - 90 * DAY_MS };

export function TrainingHistory() {
  const history = useQuery(api.workout.sessions.listEndedSummaries, { limit: 12 });
  const summary = useQuery(api.trainingKnowledge.summarizeWindow, HISTORY_WINDOW);
  const records = useQuery(api.trainingKnowledge.getRecordHighlights, { limit: 4 });

  return (
    <div className="page-stack">
      <header className="page-header"><div><p className="eyebrow">Training</p><h1>Your record, without the logging UI.</h1><p>Sessions are captured on mobile. Web gives you room to review what happened and what is changing.</p></div><span className="read-only-badge">Read only</span></header>
      <section className="metrics-strip"><Metric value={summary ? String(summary.activityCount) : '—'} label="logged sets · 90 days" /><Metric value={summary ? String(summary.byExercise.length) : '—'} label="movements trained" /><Metric value={records ? String(records.totalRecords) : '—'} label="personal records tracked" /></section>
      {records?.highlights.length ? <section className="panel"><div className="section-heading"><div><p className="eyebrow">Signals</p><h2>Recent record highlights</h2></div></div><div className="record-grid">{records.highlights.map((record, index) => <article className="record-card" key={index}><strong>{record.exerciseName}</strong><span>{record.label}</span><small>{record.displayValue}</small></article>)}</div></section> : null}
      <section className="panel history-panel"><div className="section-heading"><div><p className="eyebrow">Sessions</p><h2>Completed on mobile</h2></div></div><div className="history-list">{history?.summaries.map(session => <article className="history-session" key={session.sessionId}><div className="history-date"><strong>{formatDay(session.startedAt)}</strong><span>{formatMonth(session.startedAt)}</span></div><div className="history-session-body"><div className="history-session-heading"><div><strong>{session.exerciseCount} exercise{session.exerciseCount === 1 ? '' : 's'}</strong><span>{duration(session.startedAt, session.endedAt)}</span></div>{session.userNotes ? <p>{session.userNotes}</p> : null}</div><div className="exercise-table">{session.exercises.map((exercise, index) => <div key={`${exercise.exerciseName}-${index}`}><strong>{exercise.exerciseName}</strong><span>{exercise.setCount} set{exercise.setCount === 1 ? '' : 's'}</span><small>{exercise.lastLoggedSummary ?? 'No logged outcome'}</small></div>)}</div></div></article>)}{history && history.summaries.length === 0 ? <p className="empty-copy">No completed sessions yet. Finish one on mobile and it will appear here.</p> : null}</div></section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div>; }
function formatDay(value: number) { return new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(value); }
function formatMonth(value: number) { return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(value); }
function duration(start: number, end: number) { const minutes = Math.max(1, Math.round((end - start) / 60_000)); return `${minutes} min`; }
