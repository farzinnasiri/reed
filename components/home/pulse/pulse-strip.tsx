import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LiveDot } from '@/components/ui/live-dot';
import { ReedText } from '@/components/ui/reed-text';
import { useCompactElapsedLabel } from '@/components/workout/use-compact-elapsed-label';
import { useReedTheme } from '@/design/provider';
import { reedPulseStripMetrics } from '@/design/system';
import type { ActiveWorkout } from '../app-shell-context';
import type { PulseData } from './use-pulse';

export const PULSE_STRIP_HEIGHT = 52;

const DAY_COUNT = 7;
const RING_SIZE = 18;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// The collapsed Pulse keeps the week and current date on one row.
export function PulseStrip({ pulse, dateLabel }: { pulse: PulseData | undefined; dateLabel: string }) {
  const { theme } = useReedTheme();
  const [width, setWidth] = useState(0);
  const days = pulse?.week.days ?? Array.from({ length: DAY_COUNT }, () => 'none' as const);
  const goal = pulse?.nearestGoal ?? null;
  const compact = width < reedPulseStripMetrics.compactWidth;

  return (
    <StripFrame onWidth={setWidth} chevron="chevron-down">
      <View style={[styles.row, { gap: theme.spacing.xs }]}>
        <View style={styles.item}>
          <View style={[styles.days, compact && { gap: reedPulseStripMetrics.compactDayGap }]}>
            {days.map((day, index) => (
              <View
                key={index}
                style={[
                  styles.day,
                  compact && { width: reedPulseStripMetrics.compactDayWidth },
                  day === 'done' ? { backgroundColor: theme.colors.accent } : null,
                  day === 'today' ? { borderColor: theme.colors.accent, borderWidth: 1.5 } : null,
                  day === 'none' ? { backgroundColor: theme.colors.surfaceHigh } : null,
                ]}
              />
            ))}
          </View>
          {pulse ? (
            <View style={styles.readout}>
              <StripNumber>{pulse.week.count}</StripNumber>
              {pulse.week.target !== null ? <ReedText tone="muted" variant="caption">of {pulse.week.target}</ReedText> : null}
            </View>
          ) : null}
        </View>

        <Separator />
        <ReedText variant="caption" tone="secondary" numberOfLines={1} style={styles.date}>{dateLabel}</ReedText>

        {goal && width >= reedPulseStripMetrics.goalRingMinWidth ? (
          <>
            <Separator />
            <View style={styles.item}>
              <GoalRing ratio={goal.goal > 0 ? goal.current / goal.goal : 0} />
              {width >= reedPulseStripMetrics.goalValueMinWidth ? <View style={styles.readout}>
                <StripNumber>{formatStripValue(goal.current)}</StripNumber>
                <ReedText tone="muted" variant="caption">/{formatStripValue(goal.goal)}</ReedText>
              </View> : null}
            </View>
          </>
        ) : null}
      </View>
    </StripFrame>
  );
}

// While a session is open the strip is the live activity: the session, how long it has run and
// where you are in it.
export function LivePulseStrip({ workout, dateLabel }: { workout: ActiveWorkout; dateLabel: string }) {
  const { theme } = useReedTheme();
  const elapsedLabel = useCompactElapsedLabel(workout.startedAt, workout.manualDurationSeconds);
  const position = workout.currentExerciseName
    ? workout.currentSetNumber === null
      ? workout.currentExerciseName
      : `${workout.currentExerciseName} · set ${workout.currentSetNumber}`
    : null;

  return (
    <StripFrame chevron="chevron-forward">
      <View style={[styles.row, { gap: theme.spacing.xs }]}>
        <View style={styles.item}>
          <LiveDot color={theme.colors.accent} />
          <ReedText tone="accent" variant="bodyStrong" style={styles.stripNumber}>Session</ReedText>
          <ReedText tone="accent" variant="bodyStrong" style={styles.stripNumber}>{elapsedLabel}</ReedText>
        </View>
        <Separator />
        <ReedText variant="caption" tone="secondary" numberOfLines={1} style={styles.date}>{dateLabel}</ReedText>
        {position ? (
          <>
            <Separator />
            <ReedText numberOfLines={1} style={styles.position} tone="muted" variant="caption">{position}</ReedText>
          </>
        ) : null}
      </View>
    </StripFrame>
  );
}

function StripFrame({ chevron, children, onWidth }: {
  chevron: 'chevron-down' | 'chevron-forward';
  children: ReactNode;
  onWidth?: (width: number) => void;
}) {
  const { theme } = useReedTheme();
  return (
    <View onLayout={onWidth ? event => onWidth(event.nativeEvent.layout.width) : undefined}
      style={[styles.frame, { gap: theme.spacing.xs, paddingLeft: theme.spacing.md, paddingRight: theme.spacing.chromeGutter }]}>
      <View style={styles.details}>
        {children}
      </View>
      <Ionicons color={String(theme.colors.inkMuted)} name={chevron} size={16} />
    </View>
  );
}

function StripNumber({ children }: { children: number | string }) {
  return <ReedText variant="bodyStrong" style={styles.stripNumber}>{children}</ReedText>;
}

function Separator() {
  const { theme } = useReedTheme();
  return <View style={[styles.separator, { backgroundColor: theme.colors.lineStrong }]} />;
}

function GoalRing({ ratio }: { ratio: number }) {
  const { theme } = useReedTheme();
  const filled = RING_CIRCUMFERENCE * Math.max(0, Math.min(1, ratio));

  return (
    <Svg height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} width={RING_SIZE}>
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        fill="none"
        r={RING_RADIUS}
        stroke={theme.colors.surfaceHigh}
        strokeWidth={RING_STROKE}
      />
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        fill="none"
        r={RING_RADIUS}
        stroke={theme.colors.accent}
        strokeDasharray={`${filled} ${RING_CIRCUMFERENCE}`}
        strokeLinecap="round"
        strokeWidth={RING_STROKE}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </Svg>
  );
}

// One decimal at most: `73.1`, `62.5`, `8`.
function formatStripValue(value: number) {
  return String(Math.round(value * 10) / 10);
}

const styles = StyleSheet.create({
  date: { flexShrink: 1 },
  details: { flex: 1, minWidth: 0 },
  frame: { alignItems: 'center', flexDirection: 'row', height: PULSE_STRIP_HEIGHT },
  day: {
    borderRadius: 3,
    height: 14,
    width: 6,
  },
  days: {
    flexDirection: 'row',
    gap: 3,
  },
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 7,
  },
  position: {
    flex: 1,
    minWidth: 0,
  },
  readout: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 3,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  separator: {
    height: 18,
    width: 1,
  },
  stripNumber: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
});
