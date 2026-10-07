import { useEffect, useState } from 'react';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { reedOnboardingMetrics } from '@/design/system';
import { StyleSheet, View } from 'react-native';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { BodyMap } from './pain-map';
import { ShapeCarousel } from './body-controls';
import { SEX_OPTIONS } from './content';
import { Heading, OptionCard, Reveal, Ruler } from './controls';
import type { Units } from './draft';
import { useBeforeNext, useOnboardingReed } from './reed-context';
import type { StepProps } from './step-props';

const THIS_YEAR = new Date().getFullYear();
const BORN_FALLBACK = THIS_YEAR - 30;
const UNIT_OPTIONS = [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }] as const;

export function SexStep({ draft, update, editing }: StepProps) {
  const { theme, setAccentChoice, setAutomaticAccent } = useReedTheme();
  const icons = ['male-outline', 'female-outline', 'transgender-outline', 'shield-outline'] as const;
  const colors = [theme.colors.accentInk, theme.colors.dataWarm, theme.colors.successInk, theme.colors.inkSecondary];
  return (
    <>
      <Heading title="What’s your gender?" />
      <View style={styles.stack}>
        {SEX_OPTIONS.map((option, index) => (
          <Reveal delay={350 + index * 50} key={option.value}>
            <OptionCard icon={icons[index]} iconColor={String(colors[index])} onPress={() => { update({ sex: option.value }); if (!editing) setAccentChoice('automatic'); setAutomaticAccent(option.value); }} selected={draft.sex === option.value} title={option.label} />
          </Reveal>
        ))}
      </View>
    </>
  );
}

function ageNote(age: number) {
  if (age < 30) return 'Good years to build a base that lasts.';
  if (age < 45) return 'Plenty of peak left. Recovery starts to count more.';
  if (age < 60) return 'Strength and mobility pay off most now.';
  return 'Staying in the game is the whole game.';
}

export function BornStep({ draft, update }: StepProps) {
  const [settledYear, setSettledYear] = useState(draft.birthYear);
  useEffect(() => {
    const timer = setTimeout(() => setSettledYear(draft.birthYear), 450);
    return () => clearTimeout(timer);
  }, [draft.birthYear]);
  useBeforeNext(() => {
    if (draft.birthYear === null) update({ birthYear: BORN_FALLBACK });
  });
  return (
    <>
      <Heading sub="Just the year is enough." title="What year were you born?" />
      <Reveal delay={400}>
        <Ruler
          caption={year => `${THIS_YEAR - year} this year.`}
          fallback={BORN_FALLBACK}
          format={String}
          labelEvery={10}
          max={THIS_YEAR - 13}
          min={THIS_YEAR - 85}
          onChange={birthYear => update({ birthYear })}
          tickEvery={5}
          tickGap={14}
          value={draft.birthYear}
        />
      </Reveal>
      <ReedText accessibilityLiveRegion="polite" style={{ textAlign: 'center', minHeight: 44 }} tone="secondary" variant="body">{ageNote(THIS_YEAR - (settledYear ?? BORN_FALLBACK))}</ReedText>
    </>
  );
}

function UnitToggle({ units, update }: { units: Units; update: StepProps['update'] }) {
  return (
    <SegmentedControl onChange={value => update({ units: value })} options={[...UNIT_OPTIONS]} style={styles.units} value={units} variant="pill" />
  );
}

const cmToInches = (cm: number) => Math.round(cm / 2.54);
const feet = (inches: number) => `${Math.floor(inches / 12)}′${inches % 12}″`;

export function HeightStep({ draft, update }: StepProps) {
  const metric = draft.units === 'metric';
  useBeforeNext(() => {
    if (draft.heightCm === null) update({ heightCm: 172 });
  });
  return (
    <>
      <Heading sub="Roughly is fine." title="How tall are you?" />
      <Reveal delay={400}>
        <Ruler
          fallback={metric ? 172 : 68}
          format={metric ? value => `${value} cm` : feet}
          key={draft.units}
          labelEvery={metric ? 10 : 12}
          labelFormat={metric ? undefined : unit => `${unit / 12}′`}
          max={metric ? 220 : 86}
          min={metric ? 120 : 48}
          onChange={value => update({ heightCm: metric ? value : Math.round(value * 2.54) })}
          tickEvery={metric ? 10 : 12}
          value={draft.heightCm === null ? null : metric ? draft.heightCm : cmToInches(draft.heightCm)}
        />
      </Reveal>
      <Reveal delay={500}><UnitToggle units={draft.units} update={update} /></Reveal>
    </>
  );
}

const kgToPounds = (kg: number) => Math.round(kg * 2.20462);

export function WeightStep({ draft, update }: StepProps) {
  const metric = draft.units === 'metric';
  useBeforeNext(() => {
    if (draft.weightKg === null) update({ weightKg: 70 });
  });
  return (
    <>
      <Heading sub="A rough number is fine. You can fix it any time." title="And what do you weigh?" />
      <Reveal delay={400}>
        <Ruler
          fallback={metric ? 70 : 154}
          format={value => (metric ? `${value} kg` : `${value} lb`)}
          key={draft.units}
          labelEvery={metric ? 10 : 50}
          max={metric ? 200 : 440}
          min={metric ? 30 : 66}
          onChange={value => update({ weightKg: metric ? value : Math.round(value / 2.20462) })}
          tickEvery={metric ? 5 : 10}
          value={draft.weightKg === null ? null : metric ? draft.weightKg : kgToPounds(draft.weightKg)}
        />
      </Reveal>
      <Reveal delay={500}><UnitToggle units={draft.units} update={update} /></Reveal>
    </>
  );
}

export function ShapeStep({ draft, update }: StepProps) {
  useBeforeNext(() => {
    if (draft.shape === null) update({ shape: 'average_lean' });
  });
  return (
    <>
      <Heading sub="Swipe. The closest match is enough." title="Which looks most like you?" />
      <Reveal delay={400}>
        <ShapeCarousel onChange={shape => update({ shape })} sex={draft.sex} value={draft.shape} />
      </Reveal>
    </>
  );
}

export function BodyMapStep({ draft, update }: StepProps) {
  useBeforeNext(() => update({ bodyMapDone: true }));
  const { stageViewportHeight } = useOnboardingReed();
  const [headingHeight, setHeadingHeight] = useState(0);
  const availableHeight = stageViewportHeight - headingHeight - reedOnboardingMetrics.answerGap - reedOnboardingMetrics.bodyStageClearance;
  return (
    <>
      <View onLayout={event => setHeadingHeight(event.nativeEvent.layout.height)}>
        <Heading sub="Tap where it hurts." title="Anything hurting?" />
      </View>
      <Reveal delay={400}>
        <BodyMap availableHeight={availableHeight} onChange={bodyPain => update({ bodyPain })} pain={draft.bodyPain} sex={draft.sex} shape={draft.shape} />
      </Reveal>
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  units: {
    alignSelf: 'center',
    width: 200,
  },
});
