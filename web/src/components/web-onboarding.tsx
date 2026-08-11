'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

type Goal = 'build_muscle' | 'get_stronger' | 'master_skill' | 'support_sport' | 'improve_conditioning' | 'move_without_pain';
type TrainingStyle = 'classic_gym' | 'calisthenics' | 'sport_support' | 'cardio' | 'mobility_rehab';
type Equipment = 'full_gym' | 'calisthenics_park' | 'home_equipment' | 'crowded_gym' | 'no_fixed_equipment';

export function WebOnboarding() {
  const { user } = useUser();
  const completeOnboarding = useMutation(api.profiles.completeOnboarding);
  const [name, setName] = useState(user?.firstName ?? '');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [goal, setGoal] = useState<Goal>('build_muscle');
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>('classic_gym');
  const [equipment, setEquipment] = useState<Equipment>('full_gym');
  const [trainingAge, setTrainingAge] = useState<'starting' | 'under_6_months' | 'six_to_18_months' | 'over_18_months'>('starting');
  const [weeklySessions, setWeeklySessions] = useState<'one_to_two' | 'two_to_four' | 'four_plus'>('two_to_four');
  const [sessionDuration, setSessionDuration] = useState<'under_45' | 'fortyfive_to_75' | 'over_75'>('fortyfive_to_75');
  const [effort, setEffort] = useState<'easy' | 'moderate' | 'hard'>('moderate');
  const [recoveryQuality, setRecoveryQuality] = useState<'solid' | 'mixed' | 'fragile'>('solid');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsedDate = birthDate ? new Date(`${birthDate}T12:00:00`) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      setError('Add a valid date of birth.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding({
        displayName: name.trim(),
        baseline: {
          birthDay: parsedDate.getDate(),
          birthMonth: parsedDate.getMonth() + 1,
          birthYear: parsedDate.getFullYear(),
          genderIdentity: 'prefer_not_to_say',
          heightCm: Number(heightCm),
          recoveryQuality,
        },
        bodyMetrics: {
          bodyFatPercent: null,
          restingHeartRate: null,
          skeletalMuscleMassKg: null,
          weightKg: weightKg ? Number(weightKg) : null,
        },
        constraints: { areas: [], details: {} },
        goalDetails: {},
        performanceAnchors: {
          bodyweight: {},
          cardio: { run1KmSeconds: null, run5KmSeconds: null, stairFloors: null, stairMinutes: null },
          loaded: {},
        },
        userNotes: notes.trim() || null,
        profilingConsent: true,
        rankedGoals: [goal],
        startingPoint: { bodyType: null },
        lifestyle: { dailyMovement: null, eatingRoutine: null, idleMovement: null, usualSteps: null },
        trainingReality: {
          effort,
          equipmentAccess: [equipment],
          sessionDuration,
          trainingAge,
          trainingStyles: [trainingStyle],
          weeklySessions,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="onboarding-page">
      <div className="onboarding-intro"><p className="eyebrow">Before we begin</p><h1>Give Reed the useful context.</h1><p>This profile is shared with the mobile app. You can refine it later.</p></div>
      <form className="onboarding-form" onSubmit={submit}>
        <FormSection title="You">
          <Field label="What should Reed call you?"><input required minLength={2} value={name} onChange={event => setName(event.target.value)} /></Field>
          <div className="form-grid"><Field label="Date of birth"><input required type="date" value={birthDate} onChange={event => setBirthDate(event.target.value)} /></Field><Field label="Height (cm)"><input required min="100" max="250" type="number" value={heightCm} onChange={event => setHeightCm(event.target.value)} /></Field><Field label="Weight (kg), optional"><input min="25" max="300" step="0.1" type="number" value={weightKg} onChange={event => setWeightKg(event.target.value)} /></Field></div>
        </FormSection>
        <FormSection title="Training reality">
          <div className="form-grid"><Select label="Main goal" value={goal} onChange={value => setGoal(value as Goal)} options={goalOptions} /><Select label="Training style" value={trainingStyle} onChange={value => setTrainingStyle(value as TrainingStyle)} options={styleOptions} /><Select label="Environment" value={equipment} onChange={value => setEquipment(value as Equipment)} options={equipmentOptions} /><Select label="Training experience" value={trainingAge} onChange={value => setTrainingAge(value as typeof trainingAge)} options={trainingAgeOptions} /><Select label="Weekly rhythm" value={weeklySessions} onChange={value => setWeeklySessions(value as typeof weeklySessions)} options={weeklyOptions} /><Select label="Typical session" value={sessionDuration} onChange={value => setSessionDuration(value as typeof sessionDuration)} options={durationOptions} /><Select label="Usual effort" value={effort} onChange={value => setEffort(value as typeof effort)} options={effortOptions} /><Select label="Recovery lately" value={recoveryQuality} onChange={value => setRecoveryQuality(value as typeof recoveryQuality)} options={recoveryOptions} /></div>
        </FormSection>
        <FormSection title="Anything Reed should know?">
          <Field label="Optional context"><textarea maxLength={1200} rows={4} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Constraints, preferences, or what has made training difficult." /></Field>
        </FormSection>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button button-primary button-large" disabled={saving} type="submit">{saving ? 'Saving…' : 'Enter Reed'}</button>
      </form>
    </section>
  );
}

function FormSection({ children, title }: { children: React.ReactNode; title: string }) { return <section className="form-section"><h2>{title}</h2>{children}</section>; }
function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Select({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) { return <Field label={label}><select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>; }

const goalOptions = [{ value: 'build_muscle', label: 'Build muscle' }, { value: 'get_stronger', label: 'Get stronger' }, { value: 'master_skill', label: 'Master a skill' }, { value: 'support_sport', label: 'Support a sport' }, { value: 'improve_conditioning', label: 'Improve conditioning' }, { value: 'move_without_pain', label: 'Move without pain' }];
const styleOptions = [{ value: 'classic_gym', label: 'Classic gym' }, { value: 'calisthenics', label: 'Calisthenics' }, { value: 'sport_support', label: 'Sport support' }, { value: 'cardio', label: 'Cardio' }, { value: 'mobility_rehab', label: 'Mobility / rehab' }];
const equipmentOptions = [{ value: 'full_gym', label: 'Full gym' }, { value: 'calisthenics_park', label: 'Calisthenics park' }, { value: 'home_equipment', label: 'Home equipment' }, { value: 'crowded_gym', label: 'Crowded gym' }, { value: 'no_fixed_equipment', label: 'No fixed equipment' }];
const trainingAgeOptions = [{ value: 'starting', label: 'Starting now' }, { value: 'under_6_months', label: 'Under 6 months' }, { value: 'six_to_18_months', label: '6–18 months' }, { value: 'over_18_months', label: 'Over 18 months' }];
const weeklyOptions = [{ value: 'one_to_two', label: '1–2 sessions' }, { value: 'two_to_four', label: '2–4 sessions' }, { value: 'four_plus', label: '4+ sessions' }];
const durationOptions = [{ value: 'under_45', label: 'Under 45 minutes' }, { value: 'fortyfive_to_75', label: '45–75 minutes' }, { value: 'over_75', label: 'Over 75 minutes' }];
const effortOptions = [{ value: 'easy', label: 'Easy' }, { value: 'moderate', label: 'Moderate' }, { value: 'hard', label: 'Hard' }];
const recoveryOptions = [{ value: 'solid', label: 'Solid' }, { value: 'mixed', label: 'Mixed' }, { value: 'fragile', label: 'Fragile' }];
