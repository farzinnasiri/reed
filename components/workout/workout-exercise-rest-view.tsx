import { Pressable, View, useWindowDimensions } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { WorkoutRestRing } from './workout-rest-ring';
import { styles } from './workout-exercise-rest-view.styles';
import type { RestCard } from './workout-surface.types';
import { WorkoutSwipeCard } from './workout-swipe-card';
import { useRestCountdown } from './use-rest-countdown';

type RestViewProps = {
  errorMessage: string | null;
  isWorking: boolean;
  onAdjustRest: (deltaSeconds: number) => void;
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
  onPresetRest,
  onRestSwipeLeft,
  onRestSwipeRight,
  onToggleRestRunning,
  restCard,
}: RestViewProps) {
  const { theme } = useReedTheme();
  const { width } = useWindowDimensions();
  const timerRingSize = Math.max(176, Math.min(236, Math.floor(width - 130)));
  const countdown = useRestCountdown(restCard)!;
  const restRemaining = countdown.remainingSeconds;
  const restRunning = countdown.isRunning;

  return (
    <WorkoutSwipeCard
      disabled={isWorking}
      hint="Swipe right to start next · Swipe left to return to set"
      leftIcon="play-back"
      leftLabel="Back to set"
      leftTone="danger"
      rightIcon="play-forward"
      rightLabel="Next set"
      onSwipeLeft={onRestSwipeLeft}
      onSwipeRight={onRestSwipeRight}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <ReedText tone="muted" variant="caption">
            Next set {restCard.nextSetNumber}
            {restCard.previousSetSummary ? ` · ${restCard.previousSetSummary}` : ''}
          </ReedText>
        </View>
      </View>

      <View style={styles.restBody}>
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
