import { Image, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SessionCategory } from '@/domains/workout/session-presentation';
import { useReedTheme } from '@/design/provider';
import { reedWorkoutReviewMetrics } from '@/design/system';

/** Decorative category artwork is always paired with the workout's visible name. */
export function SessionArtwork({ category }: { category: SessionCategory }) {
  const { theme } = useReedTheme();
  const size = reedWorkoutReviewMetrics.artwork;
  const sources = {
    'upper-body': require('@/assets/workout-illustrations/upper-body.png'),
    'lower-body': require('@/assets/workout-illustrations/lower-body.png'),
    'full-body': require('@/assets/workout-illustrations/full-body.png'),
    cardio: require('@/assets/workout-illustrations/cardio.png'),
  };
  const source =
    category === 'mixed'
      ? sources['full-body']
      : category in sources
        ? sources[category as keyof typeof sources]
        : null;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {source ? (
        <Image
          source={source}
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      ) : (
        <Ionicons
          name={
            category === 'unlogged'
              ? 'remove-outline'
              : category === 'cardio'
                ? 'walk-outline'
                : 'barbell-outline'
          }
          size={32}
          color={String(theme.colors.inkMuted)}
        />
      )}
    </View>
  );
}
