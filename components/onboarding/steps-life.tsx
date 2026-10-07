import { useState } from 'react';
import { DiscreteScale } from './discrete-scale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { reedOnboardingMetrics, reedRadii } from '@/design/system';
import { usePressAnimation } from '@/design/use-press-animation';
import { BLOCK_WEEKS, DAY_LOAD_OPTIONS, PUSH_OPTIONS, RHYTHMS, SLEEP_OPTIONS, WEEKDAYS, type DayState } from './content';
import { Heading, NumberTiles, OptionCard, Reveal, SectionLabel } from './controls';
import { useOnboardingReed } from './reed-context';
import type { StepProps } from './step-props';

export function SleepStep({ draft, update }: StepProps) {
  const { theme } = useReedTheme();
  return (
    <>
      <Heading sub="On a normal night." title="How much do you sleep?" />
      <Reveal delay={400}>
        <NumberTiles onChange={sleep => update({ sleep })} options={SLEEP_OPTIONS} value={draft.sleep} />
      </Reveal>
      {draft.sleep !== null ? <Reveal>
        <DiscreteScale label="And how well?" value={draft.sleepQuality} onChange={sleepQuality => update({ sleepQuality })} stops={[
          { label: 'Restless', color: String(theme.colors.dangerInk) },
          { label: 'Broken', color: String(theme.colors.dataWarm) },
          { label: 'Okay', color: String(theme.colors.inkSecondary) },
          { label: 'Good', color: String(theme.colors.accentInk) },
          { label: 'Rested', color: String(theme.colors.successInk) },
        ]} />
        <ReedText style={{ marginTop: 12 }} tone="muted" variant="caption">Optional. Think about how you usually feel when you wake up.</ReedText>
      </Reveal> : null}
    </>
  );
}

export function DayStep({ draft, update }: StepProps) {
  return (
    <>
      <Heading sub="Outside of training." title="What do your days put you through?" />
      <View style={styles.stack}>
        {DAY_LOAD_OPTIONS.map((option, index) => (
          <Reveal delay={350 + index * 50} key={option.id}>
            <OptionCard icon={option.icon} onPress={() => update({ dayLoad: option.id })} selected={draft.dayLoad === option.id} subtitle={option.subtitle} title={option.title} />
          </Reveal>
        ))}
      </View>
    </>
  );
}

const DAY_CHOICES = [
  { value: 'free', label: 'Available', icon: 'add-circle-outline' },
  { value: 'fixed', label: 'Already training', icon: 'barbell-outline' },
  { value: 'off', label: 'Unavailable', icon: 'moon-outline' },
] as const;

export function WeekStep({ draft, update }: StepProps) {
  const [selectedDay, setSelectedDay] = useState(0);
  return (
    <>
      <Heading sub="Choose a day, then tell me what fits." title="What does your week look like?" />
      <Reveal delay={200}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.week}>
          {WEEKDAYS.map((label, index) => (
            <DayPill key={label} label={label} active={selectedDay === index} onPress={() => setSelectedDay(index)} state={draft.days[index]} />
          ))}
        </ScrollView>
        <View style={styles.dayEditor}>
          <ReedText accessibilityLiveRegion="polite" variant="bodyStrong">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][selectedDay]}</ReedText>
          <View style={styles.stack}>
            {DAY_CHOICES.map(choice => <OptionCard
              key={choice.value} icon={choice.icon} title={choice.label} selected={draft.days[selectedDay] === choice.value}
              onPress={() => { const days = [...draft.days]; days[selectedDay] = choice.value; update({ days }); }}
            />)}
          </View>
        </View>
      </Reveal>
    </>
  );
}

function DayPill({ active, label, onPress, state }: { active: boolean; label: string; onPress: () => void; state: DayState }) {
  const { theme } = useReedTheme();
  const { reed } = useOnboardingReed();
  const press = usePressAnimation();
  const fixed = state === 'fixed';
  const off = state === 'off';
  return (
    <Pressable
      accessibilityLabel={`${label}: ${DAY_CHOICES.find(choice => choice.value === state)?.label}`}
      accessibilityState={{ selected: active }}
      accessibilityRole="button"
      onPress={() => {
        haptics.selection();
        reed?.act('tick');
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.dayslot}
    >
      <Animated.View
        style={[
          styles.day,
          {
            backgroundColor: fixed ? theme.colors.accentSoft : off ? 'transparent' : theme.colors.surface,
            borderColor: active ? theme.colors.accentInk : off ? theme.colors.line : 'transparent',
          },
          press.animatedStyle,
        ]}
      >
        <ReedText style={{ color: fixed ? theme.colors.accentInk : off ? theme.colors.inkMuted : theme.colors.inkSecondary }} variant="caption">{label}</ReedText>
        <View style={styles.marker}>
          {fixed ? <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} /> : off ? <Ionicons color={String(theme.colors.inkMuted)} name="moon" size={14} /> : <View style={[styles.dot, { backgroundColor: theme.colors.lineStrong }]} />}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function RhythmStep({ draft, update }: StepProps) {
  return (
    <>
      <Heading sub="No wrong answer. I plan differently for each." title="How do you like to be coached?" />
      <View style={styles.stack}>
        {RHYTHMS.map((rhythm, index) => (
          <Reveal delay={350 + index * 60} key={rhythm.id}>
            <OptionCard icon={rhythm.icon} onPress={() => update({ rhythm: rhythm.id })} selected={draft.rhythm === rhythm.id} subtitle={rhythm.subtitle} title={rhythm.title}>
              {rhythm.id === 'rotate' ? (
                <>
                  <SectionLabel>Each focus lasts about</SectionLabel>
                  <SegmentedControl onChange={value => update({ blockWeeks: Number(value) })} options={[...BLOCK_WEEKS]} value={String(draft.blockWeeks)} variant="card" />
                </>
              ) : null}
            </OptionCard>
          </Reveal>
        ))}
      </View>
    </>
  );
}

export function PushStep({ draft, update }: StepProps) {
  return (
    <>
      <Heading sub="You can change this any time." title="How hard should I push?" />
      <View style={styles.stack}>
        {PUSH_OPTIONS.map((option, index) => (
          <Reveal delay={350 + index * 60} key={option.id}>
            <OptionCard icon={option.icon} onPress={() => update({ push: option.id })} selected={draft.push === option.id} subtitle={option.subtitle} title={option.title} />
          </Reveal>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  week: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: 6,
  },
  dayslot: { width: reedOnboardingMetrics.dayWidth, flexGrow: 1 },
  dayEditor: { gap: 12, paddingTop: 20 },
  day: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    borderWidth: 1.5,
    gap: 14,
    justifyContent: 'center',
    minHeight: 92,
  },
  marker: {
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
  },
  dot: {
    borderRadius: reedRadii.pill,
    height: 10,
    width: 10,
  },
});
