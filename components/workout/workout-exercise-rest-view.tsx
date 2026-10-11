import { Pressable, View, useWindowDimensions } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { ReedButton } from '@/components/ui/reed-button';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { WorkoutRestRing } from './workout-rest-ring';
import { styles } from './workout-exercise-rest-view.styles';
import type { RestCard } from './workout-surface.types';
import { WorkoutSwipeCard } from './workout-swipe-card';
import { useRestCountdown } from './use-rest-countdown';
import { useState } from 'react';
import { reedSessionMetrics } from '@/design/system';

type RestViewProps = {
  errorMessage: string | null;
  isWorking: boolean;
  onAdjustRest: (deltaSeconds: number) => void;
  onMoveOn: () => void;
  nextExerciseName: string | null;
  onPresetRest: (durationSeconds: number) => void;
  onRestSwipeLeft: () => void;
  onRestSwipeRight: () => void;
  onToggleRestRunning: () => void;
  restCard: RestCard;
};

export function WorkoutExerciseRestView({
  errorMessage,
  isWorking,
  onAdjustRest,
  onMoveOn,
  nextExerciseName,
  onPresetRest,
  onRestSwipeLeft,
  onRestSwipeRight,
  onToggleRestRunning,
  restCard,
}: RestViewProps) {
  const { theme } = useReedTheme();
  const { width, height } = useWindowDimensions();
  const bodyGap = height < reedSessionMetrics.compactHeight ? theme.spacing.xs : theme.spacing.lg;
  const [bodyHeight, setBodyHeight] = useState(0);
  const timerRingSize = Math.min(
    Math.max(176, Math.min(236, Math.floor(width - 130))),
    bodyHeight > 0
      ? Math.max(theme.spacing.xxxl * 3, bodyHeight - bodyGap * 2 - reedSessionMetrics.hit * 2 - theme.spacing.xs * 2)
      : 236,
  );
  const countdown = useRestCountdown(restCard)!;
  const restRemaining = countdown.remainingSeconds;
  const restRunning = countdown.isRunning;

  return (
    <WorkoutSwipeCard
      disabled={isWorking}
      hint="Swipe right for another set"
      leftIcon="play-back"
      leftLabel="Back to set"
      leftTone="danger"
      rightIcon="play-forward"
      rightLabel="Another set"
      onSwipeLeft={onRestSwipeLeft}
      onSwipeRight={onRestSwipeRight}
      footer={
        <View style={styles.restChoices}>
          <ReedText tone="muted" variant="caption">Swipe right for another set</ReedText>
          <View style={styles.restActions}>
            <ReedButton
              hapticTap
              disabled={isWorking}
              label="Another set"
              leading={<Ionicons color={String(theme.colors.accentInk)} name="repeat-outline" size={theme.spacing.lg} />}
              onPress={onRestSwipeRight}
              variant="quiet"
            />
            <ReedButton
              hapticTap
              disabled={isWorking}
              label="Finish exercise"
              accessibilityLabel={nextExerciseName ? `Finish exercise, go to ${nextExerciseName}` : 'Finish exercise, back to the session'}
              leading={<Ionicons color={String(theme.colors.accentInk)} name="arrow-forward" size={theme.spacing.lg} />}
              onPress={onMoveOn}
              variant="quiet"
            />
          </View>
        </View>
      }
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <ReedText tone="muted" variant="caption">
            Rest{restCard.previousSetSummary ? ` · ${restCard.previousSetSummary}` : ''}
          </ReedText>
        </View>
      </View>

      <View onLayout={event => setBodyHeight(event.nativeEvent.layout.height)} style={[styles.restBody, { gap: bodyGap }]}>
        <Pressable disabled={isWorking} onPress={onToggleRestRunning} style={({ pressed }) => [styles.timerButton, getTapScaleStyle(pressed, false)]}>
          <WorkoutRestRing
            durationSeconds={restCard.durationSeconds}
            isRunning={restRunning}
            remainingSeconds={restRemaining}
            size={timerRingSize}
          />
        </Pressable>

        <View style={styles.restSteps}>
          {[-15, 15].map(delta => (
            <Pressable
              key={delta}
              accessibilityLabel={delta > 0 ? 'Add 15 seconds' : 'Take off 15 seconds'}
              accessibilityRole="button"
              disabled={isWorking}
              onPress={() => onAdjustRest(delta)}
              style={({ pressed }) => [styles.restStep, { backgroundColor: theme.colors.surfaceRaised }, getTapScaleStyle(pressed, false)]}
            >
              <ReedText variant="bodyStrong">{delta > 0 ? `+${delta}s` : `−${-delta}s`}</ReedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.presetRow}>
          {[30, 60, 90, 120].map(seconds => {
            const selected = restCard.durationSeconds === seconds;
            return (
              <Pressable
                key={seconds}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={isWorking}
                onPress={() => onPresetRest(seconds)}
                style={({ pressed }) => [
                  styles.presetChip,
                  { backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surfaceRaised, ...getTapScaleStyle(pressed, false) },
                ]}
              >
                <ReedText tone={selected ? 'accent' : 'secondary'} variant="bodyStrong">{seconds}s</ReedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {errorMessage ? (
        <ReedText style={styles.inlineError} tone="danger">
          {errorMessage}
        </ReedText>
      ) : null}
    </WorkoutSwipeCard>
  );
}
