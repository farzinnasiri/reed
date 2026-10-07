import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View, type ColorValue } from 'react-native';
import { Surface } from '@/components/ui/surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { workoutSemanticPalette } from '@/design/system';
import { styles } from './workout-session-status-strip.styles';
import type { LiveSessionStatusStrip } from './workout-surface.types';
import { WorkoutDuration, type WorkoutTiming } from './workout-duration';

type WorkoutSessionStatusStripProps = {
  reed?: React.ReactNode;
  onBack: () => void;
  onOpenInsights?: () => void;
  status: LiveSessionStatusStrip;
  timing?: WorkoutTiming;
};

export function WorkoutSessionStatusStrip({
  onBack,
  onOpenInsights,
  status,
  timing,
  reed,
}: WorkoutSessionStatusStripProps) {
  const { theme } = useReedTheme();
  const hasMicroTokens = status.microLineTokens.length > 0;
  const workSlotLabelColor = getWorkSlotLabelColor(status.workSlotKind, theme.colors.ink);
  const workSlotIconColor = getWorkSlotIconColor(status.workSlotKind, theme.colors.inkMuted);
  const workSlotIcon = getWorkSlotIcon(status.workSlotKind);

  return (
    <Surface
      contentStyle={styles.statusStripContent}
      style={styles.statusStripShell}
    >
      <View style={styles.statusStripRow}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={onBack}
          style={({ pressed }) => [styles.navButton, styles.statusStripNavButton, getTapScaleStyle(pressed)]}
        >
          <Ionicons color={String(theme.colors.ink)} name="arrow-back" size={17} />
        </Pressable>

        <View style={styles.statusStripMetrics}>
          <View style={hasMicroTokens ? styles.statusStripCenter : [styles.statusStripCenter, styles.statusStripCenterSingle]}>
            <View style={styles.statusStripPrimaryRow}>
              <View style={styles.statusStripSegment}>
                <Ionicons name="time-outline" size={14} color={String(theme.colors.inkMuted)} />
                <WorkoutDuration timing={timing} fallback={status.durationLabel} />
              </View>

              <View style={[styles.statusStripDot, { backgroundColor: theme.colors.inkMuted }]} />

              <MetricSegment
                icon="barbell-outline"
                label={status.completedSetsLabel}
              />

              <View style={[styles.statusStripDot, { backgroundColor: theme.colors.inkMuted }]} />

              <MetricSegment
                icon={workSlotIcon}
                iconColor={workSlotIconColor}
                label={status.workSlotLabel}
                labelColor={workSlotLabelColor}
              />
            </View>

            {hasMicroTokens ? (
              <View style={styles.statusStripMicroRow}>
                {status.microLineTokens.map((token, index) => (
                  <View key={`${token}-${index}`} style={styles.statusStripMicroToken}>
                    <ReedText
                      style={[
                        styles.statusStripMicroText,
                        { color: getMicroTokenColor(token, theme.colors.inkMuted) },
                      ]}
                      variant="bodyStrong"
                    >
                      {token}
                    </ReedText>
                    {index < status.microLineTokens.length - 1 ? (
                      <View
                        style={[
                          styles.statusStripMicroDot,
                          { backgroundColor: theme.colors.inkMuted },
                        ]}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {reed}
        {onOpenInsights ? (
          <Pressable
            accessibilityLabel="Open live session insights"
            onPress={onOpenInsights}
            style={({ pressed }) => [styles.navButton, styles.statusStripNavButton, getTapScaleStyle(pressed)]}
          >
            <Ionicons color={String(theme.colors.ink)} name="ellipsis-vertical" size={16} />
          </Pressable>
        ) : (
          <View style={[styles.navButton, styles.statusStripNavButton]} />
        )}
      </View>
    </Surface>
  );
}

function MetricSegment({
  icon,
  iconColor,
  label,
  labelColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: ColorValue;
  label: string;
  labelColor?: ColorValue;
}) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.statusStripSegment}>
      <Ionicons
        color={String(iconColor ?? theme.colors.inkMuted)}
        name={icon}
        size={14}
      />
      <ReedText
        adjustsFontSizeToFit
        ellipsizeMode="clip"
        minimumFontScale={0.72}
        numberOfLines={1}
        style={labelColor ? [styles.statusStripValue, { color: labelColor }] : styles.statusStripValue}
        variant="bodyStrong"
      >
        {label}
      </ReedText>
    </View>
  );
}

function getMicroTokenColor(token: string, fallbackColor: ColorValue) {
  const normalized = token.toLowerCase();

  if (normalized.includes('km') || normalized.includes('floor')) {
    return workoutSemanticPalette.modalities.cardio;
  }

  if (normalized.includes('tension')) {
    return workoutSemanticPalette.modalities.holds;
  }

  if (normalized.includes('kg')) {
    return workoutSemanticPalette.modalities.load;
  }

  return fallbackColor;
}

function getWorkSlotLabelColor(
  kind: LiveSessionStatusStrip['workSlotKind'],
  primary: ColorValue,
) {
  switch (kind) {
    case 'cardio':
      return workoutSemanticPalette.modalities.cardio;
    case 'holds':
      return workoutSemanticPalette.modalities.holds;
    case 'load':
      return workoutSemanticPalette.modalities.load;
    case 'mixed':
      return primary;
    case 'active':
      return primary;
    default:
      return primary;
  }
}

function getWorkSlotIconColor(kind: LiveSessionStatusStrip['workSlotKind'], muted: ColorValue) {
  if (kind === 'cardio') {
    return workoutSemanticPalette.modalities.cardio;
  }

  return muted;
}

function getWorkSlotIcon(kind: LiveSessionStatusStrip['workSlotKind']): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'cardio':
      return 'walk-outline';
    case 'holds':
      return 'timer-outline';
    case 'load':
      return 'bag-handle-outline';
    case 'mixed':
      return 'apps-outline';
    case 'active':
      return 'pulse-outline';
    default:
      return 'barbell-outline';
  }
}
