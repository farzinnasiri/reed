import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import { ReedButton } from '@/components/ui/reed-button';
import { getTapScaleStyle, runReedLayoutAnimation } from '@/design/motion';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { reedOnboardingMetrics, reedRadii, withColorAlpha } from '@/design/system';
import { BODY_SHAPES, CATEGORY_BY_ID, PUSH_OPTIONS, RHYTHMS, SLEEP_OPTIONS, SYNTH_LINES, WEEKDAYS } from './content';
import { Heading, Reveal, Say } from './controls';
import { MOVE_VALUES } from './motivations';
import { PAIN_LABELS } from './pain-map';
import { askLater, firstName, levelName, proposeFocus } from './draft';
import { useOnboardingReed } from './reed-context';
import type { StepProps } from './step-props';

const SYNTH_LINE_MS = 1000;

/** Reed’s preparation beat before the overview derived from the collected answers. */
export function SynthStep({ next }: StepProps) {
  const { reed } = useOnboardingReed();
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timers = SYNTH_LINES.map((_, index) => setTimeout(() => {
      setDone(index + 1);
      haptics.selection();
      reed?.act('tick');
    }, 900 + SYNTH_LINE_MS * (index + 1)));
    const finish = setTimeout(() => {
      reed?.react('happy', 1200);
      haptics.light();
    }, 900 + SYNTH_LINE_MS * SYNTH_LINES.length + 150);
    const advance = setTimeout(next, 900 + SYNTH_LINE_MS * SYNTH_LINES.length + 900);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
      clearTimeout(advance);
    };
    // The beat plays once per mount; `next` and `reed` are stable enough for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.synth}>
      <Say delay={150} text="Give me a second." variant="display" />
      <View style={styles.synthLines}>
        {SYNTH_LINES.map((line, index) => (
          <Reveal delay={600 + index * 300} key={line}>
            <SynthLine done={done > index} label={line} working={done === index} />
          </Reveal>
        ))}
      </View>
    </View>
  );
}

function SynthLine({ done, label, working }: { done: boolean; label: string; working: boolean }) {
  const { theme } = useReedTheme();
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    pulse.set(working ? withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.35, { duration: 500 })), -1) : withTiming(done ? 1 : 0.35, { duration: 160 }));
  }, [done, pulse, working]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return (
    <View style={styles.synthLine}>
      {done ? <Ionicons color={String(theme.colors.successInk)} name="checkmark-circle" size={18} /> : <Animated.View style={[styles.synthDot, { backgroundColor: theme.colors.accent }, dot]} />}
      <ReedText style={styles.synthLabel} tone={done ? 'secondary' : 'muted'} variant="body">{label}</ReedText>
    </View>
  );
}

const cmToFeet = (cm: number) => {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
};

export function ReviewStep(props: StepProps) {
  const { draft, edit, practices } = props;
  const { theme } = useReedTheme();
  const focus = proposeFocus(draft, practices);

  const rhythm = RHYTHMS.find(entry => entry.id === draft.rhythm);
  const later = askLater(draft);
  const headline = !focus.lead
    ? 'A plan built around your week'
    : draft.rhythm === 'rotate'
      ? `${focus.lead.label} first, about ${draft.blockWeeks} ${draft.blockWeeks === 1 ? 'week' : 'weeks'}`
      : draft.rhythm === 'daily'
        ? `Day by day, ${focus.lead.label} first`
        : draft.rhythm === 'plan'
          ? `A plan led by ${focus.lead.label}`
          : `${focus.lead.label} first`;
  const bodyBits = [
    draft.sex && draft.sex !== 'private' ? { male: 'Male', female: 'Female', other: 'Other' }[draft.sex] : null,
    draft.birthYear ? `born ${draft.birthYear}` : null,
    draft.heightCm ? (draft.units === 'metric' ? `${draft.heightCm} cm` : cmToFeet(draft.heightCm)) : null,
    draft.weightKg ? (draft.units === 'metric' ? `${draft.weightKg} kg` : `${Math.round(draft.weightKg * 2.20462)} lb`) : null,
  ].filter(Boolean);
  const shape = BODY_SHAPES.find(shape => shape.value === draft.shape);
  const leadIcon = focus.lead ? CATEGORY_BY_ID[focus.lead.category].icon : 'flash';

  return (
    <>
      <Heading sub="Here's where I'd begin, and what I heard. Fix anything that's off." title={`That's enough to start, ${firstName(draft)}.`} />
      <Reveal delay={500}>
        <SummaryCard summary={headline} title="Your starting plan">
          <View style={styles.weekStrip}>
            {WEEKDAYS.map((label, index) => {
              const fixed = draft.days[index] === 'fixed';
              const off = draft.days[index] === 'off';
              const support = focus.support.includes(index);
              return (
                <View key={label} style={styles.weekCell}>
                  <ReedText tone="muted" variant="micro">{label}</ReedText>
                  <View style={[styles.weekBox, { backgroundColor: fixed ? theme.colors.accent : support ? withColorAlpha(String(theme.colors.dataWarm), 0.22) : theme.colors.surface }]}>
                    {fixed ? <Ionicons color={String(theme.colors.accentText)} name={leadIcon} size={16} /> : support ? <Ionicons color={String(theme.colors.dataWarm)} name="barbell" size={16} /> : off ? <Ionicons color={String(theme.colors.inkMuted)} name="moon" size={14} /> : null}
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <Key color={String(theme.colors.accent)} label="Your practice" />
            <Key color={String(theme.colors.dataWarm)} label="Support work" />
            <Key color={String(theme.colors.inkMuted)} label="Rest" />
          </View>
          {draft.values.map(id => <Bullet key={id}>{MOVE_VALUES.find(value => value.id === id)!.guidance}</Bullet>)}
          {focus.asks.length > 0 ? (
            <View style={styles.list}>
              <ReedText tone="secondary" variant="caption">Support work around it</ReedText>
              {focus.asks.map(ask => <Bullet key={ask}>{ask}</Bullet>)}
            </View>
          ) : null}
          {draft.rhythm === 'rotate' && focus.rotation.length > 0 ? (
            <ReedText tone="secondary" variant="body">Then: {focus.rotation.slice(0, 3).map(practice => practice.label).join(', ')}.</ReedText>
          ) : null}
        </SummaryCard>
      </Reveal>

      <Reveal delay={600}>
        <SummaryCard onEdit={() => edit('worlds')} summary={practices.map(practice => practice.label).join(', ')} title="Your world">
          <View style={styles.list}>
            {practices.map(practice => <ReviewFact key={practice.id} label={practice.label} onEdit={() => edit(`world:${practice.category}`)} value={levelName(practice.level) ?? 'Level not answered'} />)}
          </View>
        </SummaryCard>
      </Reveal>

      <Reveal delay={680}>
        <SummaryCard onEdit={() => edit('values')} summary={draft.values.map(id => MOVE_VALUES.find(value => value.id === id)!.label).join(' · ') || 'Not answered'} title="Why you work out">
          {draft.values.length ? draft.values.map((id, index) => <Bullet key={id}>{index + 1}. {MOVE_VALUES.find(value => value.id === id)!.label}</Bullet>) : <ReedText tone="secondary" variant="body">Not answered.</ReedText>}
        </SummaryCard>
      </Reveal>

      <Reveal delay={760}>
        <SummaryCard summary={bodyBits.join(' · ') || 'Not answered'} title="Your body">
          <ReviewFact label="Name" onEdit={() => edit('hello')} value={draft.name} />
          <ReviewFact label="Gender" onEdit={() => edit('sex')} value={draft.sex ? { male: 'Male', female: 'Female', other: 'Other', private: 'Prefer not to say' }[draft.sex] : 'Not answered'} />
          <ReviewFact label="Birth year" onEdit={() => edit('born')} value={draft.birthYear ? String(draft.birthYear) : 'Not answered'} />
          <ReviewFact label="Height" onEdit={() => edit('height')} value={draft.heightCm ? draft.units === 'metric' ? `${draft.heightCm} cm` : cmToFeet(draft.heightCm) : 'Not answered'} />
          <ReviewFact label="Weight" onEdit={() => edit('weight')} value={draft.weightKg ? draft.units === 'metric' ? `${draft.weightKg} kg` : `${Math.round(draft.weightKg * 2.20462)} lb` : 'Not answered'} />
          <ReviewFact label="Body shape" onEdit={() => edit('shape')} value={shape ? `${shape.label} · About ${shape.fat[draft.sex === 'female' ? 'female' : 'male']}` : 'Not answered'} />
        </SummaryCard>
      </Reveal>

      <Reveal delay={800}>
        <SummaryCard onEdit={() => edit('bodymap')} summary={Object.keys(draft.bodyPain).length ? `${Object.keys(draft.bodyPain).length} ${Object.keys(draft.bodyPain).length === 1 ? 'area' : 'areas'} to work around` : draft.bodyMapDone ? 'Nothing hurting' : 'Not answered'} title="Discomfort">
          <ReedText tone="secondary" variant="body">{Object.values(draft.bodyPain).map(point => `${point.area}: ${PAIN_LABELS[point.intensity]}`).join(', ') || (draft.bodyMapDone ? 'Nothing hurting right now.' : 'Not answered.')}</ReedText>
        </SummaryCard>
      </Reveal>
      <Reveal delay={820}>
        <SummaryCard onEdit={() => edit('sleep')} summary={draft.sleep === null ? 'Not answered' : SLEEP_OPTIONS[draft.sleep].label} title="Sleep">
          <ReedText tone="secondary" variant="body">{draft.sleep === null ? 'Not answered.' : SLEEP_OPTIONS[draft.sleep].label}{draft.sleepQuality !== null ? ` · ${['Restless', 'Broken', 'Okay', 'Good', 'Rested'][draft.sleepQuality]}` : ''}</ReedText>
        </SummaryCard>
      </Reveal>
      <Reveal delay={830}>
        <SummaryCard onEdit={() => edit('week')} summary={`${draft.days.filter(day => day === 'free').length} available days · ${draft.days.filter(day => day === 'fixed').length} training days`} title="Your week">
          <ReedText tone="secondary" variant="body">{WEEKDAYS.map((day, index) => `${day}: ${{ free: 'available', fixed: 'already training', off: 'unavailable' }[draft.days[index]]}`).join(' · ')}</ReedText>
        </SummaryCard>
      </Reveal>
      <Reveal delay={840}>
        <SummaryCard onEdit={() => edit('rhythm')} summary={`${rhythm?.title ?? 'Rhythm still open'} · ${PUSH_OPTIONS[draft.push].title}`} title="How we'll work">
          <ReedText tone="secondary" variant="body">
            {rhythm ? rhythm.title : 'Rhythm: still open'}
            {draft.rhythm === 'rotate' ? `, ${draft.blockWeeks} ${draft.blockWeeks === 1 ? 'week' : 'weeks'} at a time` : ''}
            {`. ${PUSH_OPTIONS[draft.push].title}.`}
          </ReedText>
        </SummaryCard>
      </Reveal>

      {props.editing || draft.notes.trim() ? <SummaryCard onEdit={() => edit('notes')} summary={draft.notes.trim() || 'Not added'} title="Coach notes">
        <ReedText variant="body">{draft.notes.trim() || 'Anything else you want Reed to know.'}</ReedText>
      </SummaryCard> : null}

      {later.length > 0 ? (
        <Reveal delay={900}>
          <ReedText style={styles.later} tone="muted" variant="caption">{"I'll ask about "}{later.join(', ')} when it matters.</ReedText>
        </Reveal>
      ) : null}
    </>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.keyDot, { backgroundColor: color }]} />
      <ReedText tone="muted" variant="micro">{label}</ReedText>
    </View>
  );
}

function SummaryCard({ children, onEdit, summary, title }: { children: ReactNode; onEdit?: () => void; summary: string; title: string }) {
  const { theme } = useReedTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.summaryRow, { borderBottomColor: theme.colors.line }]}>
      <Pressable {...(Platform.OS === 'web' ? { 'aria-expanded': open } : {})} accessibilityLabel={title} accessibilityRole="button" accessibilityState={{ expanded: open }} style={({ pressed }) => [styles.summaryToggle, getTapScaleStyle(pressed)]} onPress={() => { haptics.selection(); runReedLayoutAnimation(); setOpen(current => !current); }}>
        <View style={styles.summaryCopy}>
          <ReedText tone="muted" variant="caption">{title}</ReedText>
          <ReedText numberOfLines={1} tone={title === 'Your starting plan' ? 'accent' : 'secondary'} variant="body">{summary}</ReedText>
        </View>
        <Ionicons color={String(theme.colors.inkMuted)} name={open ? 'chevron-up' : 'chevron-down'} size={18} />
      </Pressable>
      {open ? <Reveal><View style={styles.summaryDetails}>
        {children}
        {onEdit ? <ReedButton label={`Edit ${title.toLowerCase()}`} onPress={onEdit} style={{ alignSelf: 'flex-start' }} variant="quiet" /> : null}
      </View></Reveal> : null}
    </View>
  );
}

function ReviewFact({ label, onEdit, value }: { label: string; onEdit: () => void; value: string }) {
  const { theme } = useReedTheme();
  return <Pressable accessibilityLabel={`Edit ${label.toLowerCase()}`} accessibilityRole="button" style={({ pressed }) => [styles.reviewFact, getTapScaleStyle(pressed)]} onPress={() => { haptics.selection(); onEdit(); }}>
    <View style={styles.summaryCopy}><ReedText tone="muted" variant="caption">{label}</ReedText><ReedText variant="body">{value}</ReedText></View>
    <Ionicons color={String(theme.colors.inkMuted)} name="create-outline" size={18} />
  </Pressable>;
}

function Bullet({ children }: { children: ReactNode }) {
  const { theme } = useReedTheme();
  return (
    <View style={styles.bullet}>
      <View style={[styles.bulletDot, { backgroundColor: theme.colors.accent }]} />
      <ReedText style={styles.bulletText} variant="body">{children}</ReedText>
    </View>
  );
}

const styles = StyleSheet.create({
  synth: {
    flexGrow: 1,
    gap: 28,
  },
  synthLines: {
    alignSelf: 'center',
    gap: 14,
    width: '100%',
  },
  synthLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  synthDot: {
    borderRadius: reedRadii.pill,
    height: 8,
    marginHorizontal: 5,
    width: 8,
  },
  synthLabel: {
    flexShrink: 1,
  },
  summaryRow: { borderBottomWidth: 1 },
  summaryToggle: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  summaryCopy: { flex: 1, gap: 2 },
  summaryDetails: { gap: 12, paddingBottom: 12 },
  reviewFact: { minHeight: reedOnboardingMetrics.hit, flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
  },
  weekCell: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  weekBox: {
    alignItems: 'center',
    borderRadius: reedRadii.sm,
    height: 44,
    justifyContent: 'center',
    width: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  key: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  keyDot: {
    borderRadius: reedRadii.pill,
    height: 8,
    width: 8,
  },
  list: {
    gap: 8,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  bullet: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  bulletDot: {
    borderRadius: reedRadii.pill,
    height: 6,
    marginTop: 8,
    width: 6,
  },
  bulletText: {
    flex: 1,
  },
  later: {
    textAlign: 'center',
  },
});
