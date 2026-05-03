import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, View, type ColorValue, type ViewStyle } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { workoutSemanticPalette } from '@/design/system';
import { styles } from './workout-surface.styles';
import type { LiveSessionStatusStrip } from './workout-surface.types';

type WorkoutSessionStatusStripProps = {
  onBack: () => void;
  onOpenInsights: () => void;
  status: LiveSessionStatusStrip;
};

export function WorkoutSessionStatusStrip({
  onBack,
  onOpenInsights,
  status,
}: WorkoutSessionStatusStripProps) {
  const { theme } = useReedTheme();
  const hasMicroTokens = status.microLineTokens.length > 0;
  const workSlotLabelColor = getWorkSlotLabelColor(status.workSlotKind, theme.colors.textPrimary);
  const workSlotIconColor = getWorkSlotIconColor(status.workSlotKind, theme.colors.textMuted);
  const workSlotIcon = getWorkSlotIcon(status.workSlotKind);
  const pillShadowStyle: ViewStyle =
    Platform.OS === 'web'
      ? {
          boxShadow:
            theme.mode === 'dark'
              ? '0px 24px 30px -22px rgba(2, 6, 23, 0.34)'
              : '0px 18px 24px -20px rgba(15, 23, 42, 0.08)',
        }
      : theme.shadows.card;

  return (
    <GlassSurface
      contentStyle={styles.statusStripContent}
      style={[styles.statusStripShell, pillShadowStyle]}
    >
      <View style={styles.statusStripRow}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={onBack}
          style={({ pressed }) => [styles.navButton, styles.statusStripNavButton, getTapScaleStyle(pressed)]}
        >
          <Ionicons color={String(theme.colors.textPrimary)} name="arrow-back" size={17} />
        </Pressable>

        <View style={styles.statusStripMetrics}>
          <View style={hasMicroTokens ? styles.statusStripCenter : [styles.statusStripCenter, styles.statusStripCenterSingle]}>
            <View style={styles.statusStripPrimaryRow}>
              <MetricSegment
                icon="time-outline"
                label={status.durationLabel}
              />

              <View style={[styles.statusStripDot, { backgroundColor: theme.colors.textMuted }]} />

              <MetricSegment
                icon="barbell-outline"
                label={status.completedSetsLabel}
              />

              <View style={[styles.statusStripDot, { backgroundColor: theme.colors.textMuted }]} />

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
                        { color: getMicroTokenColor(token, theme.colors.textMuted) },
                      ]}
                      variant="bodyStrong"
                    >
                      {token}
                    </ReedText>
                    {index < status.microLineTokens.length - 1 ? (
                      <View
                        style={[
                          styles.statusStripMicroDot,
                          { backgroundColor: theme.colors.textMuted },
                        ]}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityLabel="Open live session insights"
          onPress={onOpenInsights}
          style={({ pressed }) => [styles.navButton, styles.statusStripNavButton, getTapScaleStyle(pressed)]}
        >
          <Ionicons color={String(theme.colors.textPrimary)} name="ellipsis-vertical" size={16} />
        </Pressable>
      </View>
    </GlassSurface>
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
        color={String(iconColor ?? theme.colors.textMuted)}
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
