'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

export function Profile() {
  const viewer = useQuery(api.profiles.viewer, {});
  const training = useQuery(api.profiles.viewerTrainingProfile, {});
  const bodyWeight = useQuery(api.profiles.bodyWeightTrend, { rangeDays: 90 });

  if (!viewer || !training || bodyWeight === undefined) {
    return <div className="page-loading"><p>Loading your profile…</p></div>;
  }

  return <ProfileContent key={`${viewer?.updatedAt ?? 0}:${bodyWeight.at(-1)?.observedAt ?? 0}`} viewer={viewer} training={training} bodyWeight={bodyWeight} />;
}

function ProfileContent({ bodyWeight, training, viewer }: {
  bodyWeight: Array<{ observedAt: number; value: number }>;
  training: NonNullable<ReturnType<typeof useQuery<typeof api.profiles.viewerTrainingProfile>>>;
  viewer: NonNullable<ReturnType<typeof useQuery<typeof api.profiles.viewer>>>;
}) {
  const { openUserProfile } = useClerk();
  const { user } = useUser();
  const updateBasics = useMutation(api.profiles.updateViewerBasics);
  const upsertWeight = useMutation(api.profiles.upsertTodayBodyWeight);
  const [displayName, setDisplayName] = useState(viewer?.displayName ?? '');
  const [weight, setWeight] = useState(bodyWeight.at(-1) ? String(bodyWeight.at(-1)?.value) : '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      await updateBasics({ displayName });
      if (weight) {
        const now = new Date();
        const dayStartAt = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const dayEndAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        await upsertWeight({ dayStartAt, dayEndAt, observedAt: now.getTime(), valueKg: Number(weight) });
      }
      setMessage('Profile updated.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not save your profile.'); }
    finally { setSaving(false); }
  }

  const profile = training?.trainingProfile;
  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">Profile</p><h1>The context Reed works from.</h1><p>This profile is shared across web, iOS, and Android.</p></div><button className="button button-secondary" onClick={() => openUserProfile()}>Manage Clerk account</button></header>
    <section className="profile-grid">
      <form className="panel profile-form" onSubmit={save}><div className="section-heading"><div><p className="eyebrow">Basics</p><h2>Your visible profile</h2></div></div><label className="field"><span>Display name</span><input minLength={2} required value={displayName} onChange={event => setDisplayName(event.target.value)} /></label><label className="field"><span>Current weight (kg)</span><input min="25" max="300" step="0.1" type="number" value={weight} onChange={event => setWeight(event.target.value)} /></label><div className="account-line"><span>Account email</span><strong>{user?.primaryEmailAddress?.emailAddress ?? viewer?.email}</strong></div>{message ? <p className={message === 'Profile updated.' ? 'form-success' : 'form-error'}>{message}</p> : null}<button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></form>
      <article className="panel"><div className="section-heading"><div><p className="eyebrow">Training reality</p><h2>What Reed currently assumes</h2></div></div>{profile ? <dl className="definition-list"><Definition label="Main goals" value={profile.rankedGoals.map(labelize).join(', ')} /><Definition label="Experience" value={labelize(profile.trainingReality.trainingAge)} /><Definition label="Weekly rhythm" value={labelize(profile.trainingReality.weeklySessions)} /><Definition label="Session length" value={labelize(profile.trainingReality.sessionDuration)} /><Definition label="Usual effort" value={labelize(profile.trainingReality.effort)} /><Definition label="Recovery" value={labelize(profile.baseline.recoveryQuality)} /><Definition label="Environment" value={profile.trainingReality.equipmentAccess.map(labelize).join(', ')} /><Definition label="Styles" value={profile.trainingReality.trainingStyles.map(labelize).join(', ')} /></dl> : <p className="empty-copy">Training context is loading.</p>}</article>
    </section>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">Body weight · 90 days</p><h2>{bodyWeight.length ? `${bodyWeight.at(-1)?.value} kg latest` : 'No weight history yet'}</h2></div></div><WeightTrend points={bodyWeight} /></section>
  </div>;
}

function Definition({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function labelize(value: string) { return value.replaceAll('_', ' ').replace('fortyfive', '45').replace('one to two', '1–2').replace('two to four', '2–4').replace('four plus', '4+'); }
function WeightTrend({ points }: { points: Array<{ observedAt: number; value: number }> }) {
  if (points.length < 2) return <p className="empty-copy">Add weight above to begin a private trend.</p>;
  const values = points.map(point => point.value); const min = Math.min(...values); const max = Math.max(...values); const range = Math.max(1, max - min);
  return <div className="weight-chart" aria-label="Body-weight trend">{points.map(point => <i key={point.observedAt} style={{ height: `${24 + ((point.value - min) / range) * 76}%` }} title={`${point.value} kg`} />)}</div>;
}
