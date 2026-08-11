'use client';

import { useMutation, useQuery } from 'convex/react';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

type GoalProgress = { current: number; required: number; valueLabel?: string };
type TrainingTarget = {
  _id: string;
  endsAt: number;
  previewText: string;
  progressSummary: GoalProgress & { currentLabel: string; overall?: GoalProgress };
  status: string;
  title: string;
};

export function Goals() {
  const targets = useQuery(api.trainingTargets.list, { includeArchived: false }) as TrainingTarget[] | undefined;
  const create = useMutation(api.trainingTargets.create);
  const complete = useMutation(api.trainingTargets.completeManually);
  const archive = useMutation(api.trainingTargets.archive);
  const refresh = useMutation(api.trainingTargets.refreshActive);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('Train consistently');
  const [sessions, setSessions] = useState('3');
  const [weeks, setWeeks] = useState('4');
  const [cadence, setCadence] = useState<'total' | 'weekly'>('weekly');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const periodCount = Math.max(1, Math.round(Number(weeks)));
      const threshold = Math.max(1, Math.round(Number(sessions)));
      const previewText = cadence === 'weekly' ? `${threshold} training days per week for ${periodCount} weeks` : `${threshold} training days in ${periodCount} weeks`;
      await create({
        endsAt: Date.now() + periodCount * 7 * 24 * 60 * 60 * 1000,
        previewText,
        rule: { cadence, exerciseCatalogId: null, metricKind: 'sessionCount', periodCount: cadence === 'weekly' ? periodCount : undefined, threshold, thresholdUnit: 'sessions' },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        title: title.trim(),
      });
      setShowForm(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the goal.'); }
    finally { setSaving(false); }
  }

  const active = targets?.filter(target => target.status === 'active') ?? [];
  const finished = targets?.filter(target => target.status !== 'active') ?? [];

  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">Goals</p><h1>Make the target concrete.</h1><p>Goals are measured from work logged on mobile. Web is where you shape and review them.</p></div><button className="button button-primary" onClick={() => setShowForm(value => !value)}>{showForm ? 'Close' : 'New goal'}</button></header>
    {showForm ? <form className="panel goal-form" onSubmit={submit}><div className="section-heading"><div><p className="eyebrow">New goal</p><h2>A training-rhythm target</h2></div></div><div className="form-grid"><label className="field"><span>Name</span><input minLength={2} required value={title} onChange={event => setTitle(event.target.value)} /></label><label className="field"><span>Measure</span><select value={cadence} onChange={event => setCadence(event.target.value as typeof cadence)}><option value="weekly">Every week</option><option value="total">Across the whole period</option></select></label><label className="field"><span>Training days</span><input min="1" type="number" value={sessions} onChange={event => setSessions(event.target.value)} /></label><label className="field"><span>Weeks</span><input min="1" max="52" type="number" value={weeks} onChange={event => setWeeks(event.target.value)} /></label></div>{error ? <p className="form-error">{error}</p> : null}<button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save goal'}</button></form> : null}
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">Active</p><h2>{active.length ? `${active.length} target${active.length === 1 ? '' : 's'} in motion` : 'Nothing active'}</h2></div><button className="text-button" onClick={() => void refresh({})}>Refresh from logs</button></div><div className="goal-list">{active.map(target => <GoalCard key={target._id} target={target} onComplete={() => void complete({ targetId: target._id })} onArchive={() => void archive({ targetId: target._id })} />)}{targets && !active.length ? <p className="empty-copy">Create a target above. Reed will evaluate it from mobile activity.</p> : null}</div></section>
    {finished.length ? <section className="panel"><div className="section-heading"><div><p className="eyebrow">Past</p><h2>Completed and missed</h2></div></div><div className="goal-list">{finished.map(target => <GoalCard key={target._id} target={target} onArchive={() => void archive({ targetId: target._id })} />)}</div></section> : null}
  </div>;
}

function GoalCard({ onArchive, onComplete, target }: { onArchive: () => void; onComplete?: () => void; target: TrainingTarget }) {
  const progress = target.progressSummary.overall ?? target.progressSummary;
  const ratio = progress.required > 0 ? Math.min(1, progress.current / progress.required) : 0;
  return <article className="goal-card"><div className="goal-card-top"><div><strong>{target.title}</strong><span>{target.previewText}</span></div><span className={`status status-${target.status}`}>{target.status}</span></div><div className="progress-track"><i style={{ width: `${ratio * 100}%` }} /></div><div className="goal-card-meta"><span>{'valueLabel' in progress ? progress.valueLabel : target.progressSummary.currentLabel}</span><span>Due {new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(target.endsAt)}</span></div><div className="goal-actions">{onComplete ? <button className="text-button" onClick={onComplete}>Mark complete</button> : null}<button className="text-button text-button-muted" onClick={onArchive}>Archive</button></div></article>;
}
