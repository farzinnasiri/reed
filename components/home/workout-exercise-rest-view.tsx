import { Pressable, View, useWindowDimensions } from 'react-native';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { WorkoutRestRing } from './workout-rest-ring';
import { styles } from './workout-surface.styles';
import type { RestCard } from './workout-surface.types';
import { WorkoutSwipeCard } from './workout-swipe-card';

type RestViewProps = {
  errorMessage: string | null;
  isWorking: boolean;
  onAdjustRest: (deltaSeconds: number) => void;
  onPresetRest: (durationSeconds: number) => void;
  onRestSwipeLeft: () => void;
  onRestSwipeRight: () => void;
  onToggleRestRunning: () => void;
  restCard: RestCard;
  restRemaining: number;
  restRunning: boolean;
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
  restRemaining,
  restRunning,
}: RestViewProps) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);
  const { width } = useWindowDimensions();
  const timerRingSize = Math.max(176, Math.min(228, Math.floor(width - 150)));

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
        <View style={styles.restMainGroup}>
          <View style={styles.restTopRow}>
            <Pressable onPress={onToggleRestRunning} style={({ pressed }) => [styles.timerButton, getTapScaleStyle(pressed, isWorking)]}>
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
                  onPress={() => onAdjustRest(delta)}
                  style={({ pressed }) => [
                    styles.restStep,
                    {
                      backgroundColor: glassControls.shellBackgroundColor,
                      borderColor: glassControls.shellBorderColor,
                      ...getTapScaleStyle(pressed, isWorking),
                    },
                  ]}
                >
                  <ReedText variant="title">{delta > 0 ? `+${delta}` : `${delta}`}</ReedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.presetRow}>
          {[30, 60, 90, 120].map(seconds => (
            <Pressable
              key={seconds}
              onPress={() => onPresetRest(seconds)}
              style={({ pressed }) => [
                styles.presetChip,
                {
                  backgroundColor:
                    restCard.durationSeconds === seconds
                      ? glassControls.activeBackgroundColor
                      : 'transparent',
                  borderColor:
                    restCard.durationSeconds === seconds
                      ? glassControls.activeBorderColor
                      : 'transparent',
                  borderWidth: restCard.durationSeconds === seconds ? 3 : 1,
                  ...getTapScaleStyle(pressed, isWorking),
                },
              ]}
            >
              <ReedText
                style={{
                  color:
                    restCard.durationSeconds === seconds ? theme.colors.accentPrimary : theme.colors.textPrimary,
                }}
                variant="title"
              >
                {seconds}s
              </ReedText>
            </Pressable>
          ))}
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
