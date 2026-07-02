import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  TAB_PILL_MIN_HEIGHT,
  canUseGlassBlur,
  getGlassTabPillTokens,
} from '@/components/ui/glass-material';
import { createTiming, getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type GlassTabPillItem<T extends string> = {
  accessibilityLabel: string;
  hasIndicator?: boolean;
  icon: ReactNode;
  id: T;
  isActive: boolean;
};

type GlassTabPillProps<T extends string> = {
  items: readonly GlassTabPillItem<T>[];
  onPress: (id: T) => void;
};

const SHELL_HORIZONTAL_PADDING = 10;
const SHELL_VERTICAL_PADDING = 7;
const ACTIVE_PIN_WIDTH = 24;
const SHOULD_USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function GlassTabPill<T extends string>({ items, onPress }: GlassTabPillProps<T>) {
  const { reducedTransparency, theme } = useReedTheme();
  const pane = getGlassTabPillTokens(theme);
  const canUseBlur = canUseGlassBlur() && !reducedTransparency;
  const shellBackground = canUseBlur ? pane.backgroundColor : pane.fallbackBackgroundColor;
  const activeIndex = Math.max(0, items.findIndex(item => item.isActive));
  const progress = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    createTiming(progress, activeIndex, reedMotion.durations.standard, undefined, SHOULD_USE_NATIVE_DRIVER).start();
  }, [activeIndex, progress]);

  return (
    <View
      style={[
        styles.shell,
        pane.shadowStyle,
        {
          backgroundColor: shellBackground,
          borderColor: pane.borderColor,
        },
      ]}
    >
      {canUseBlur ? (
        <BlurView
          intensity={pane.blurIntensity}
          style={StyleSheet.absoluteFill}
          tint={theme.blur.tint}
        />
      ) : null}

      <View
        style={[
          StyleSheet.absoluteFill,
          styles.highlight,
          {
            backgroundColor: canUseBlur ? 'transparent' : shellBackground,
            borderColor: pane.borderColor,
          },
        ]}
      />

      <View style={styles.row}>
        {items.map(item => (
          <GlassTabPillButton
            accessibilityLabel={item.accessibilityLabel}
            hasIndicator={item.hasIndicator}
            icon={item.icon}
            index={items.findIndex(candidate => candidate.id === item.id)}
            isActive={item.isActive}
            key={item.id}
            onPress={() => onPress(item.id)}
            progress={progress}
          />
        ))}
      </View>
    </View>
  );
}

function GlassTabPillButton({
  accessibilityLabel,
  hasIndicator = false,
  icon,
  index,
  isActive,
  onPress,
  progress,
}: {
  accessibilityLabel: string;
  hasIndicator?: boolean;
  icon: ReactNode;
  index: number;
  isActive: boolean;
  onPress: () => void;
  progress: Animated.Value;
}) {
  const { theme } = useReedTheme();
  const iconScale = progress.interpolate({
    extrapolate: 'clamp',
    inputRange: [index - 1, index, index + 1],
    outputRange: [1, reedMotion.scale.activeTab, 1],
  });
  const activePinOpacity = progress.interpolate({
    extrapolate: 'clamp',
    inputRange: [index - 0.55, index, index + 0.55],
    outputRange: [0, 1, 0],
  });
  const activePinScaleX = progress.interpolate({
    extrapolate: 'clamp',
    inputRange: [index - 0.55, index, index + 0.55],
    outputRange: [0.45, 1, 0.45],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, getTapScaleStyle(pressed)]}
    >
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
        {icon}
        <Animated.View
          style={[
            styles.activePin,
            {
              backgroundColor: theme.colors.accentPrimary,
              opacity: activePinOpacity,
              transform: [{ scaleX: activePinScaleX }],
            },
          ]}
        />
        {hasIndicator ? (
          <View style={[styles.indicatorDot, { backgroundColor: theme.colors.accentSecondary }]} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: reedRadii.xl,
    borderWidth: 1,
    minHeight: TAB_PILL_MIN_HEIGHT,
    overflow: 'hidden',
    paddingHorizontal: SHELL_HORIZONTAL_PADDING,
    paddingVertical: SHELL_VERTICAL_PADDING,
    position: 'relative',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  activePin: {
    borderRadius: reedRadii.pill,
    bottom: -11,
    height: 3,
    left: '50%',
    marginLeft: -ACTIVE_PIN_WIDTH / 2,
    position: 'absolute',
    width: ACTIVE_PIN_WIDTH,
  },
  highlight: {
    borderTopWidth: 1,
    opacity: 0.75,
    pointerEvents: 'none',
  },
  item: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    flex: 1,
    height: 50,
    justifyContent: 'center',
    zIndex: 1,
  },
  iconWrap: {
    position: 'relative',
  },
  indicatorDot: {
    borderRadius: 3,
    height: 6,
    position: 'absolute',
    right: -4,
    top: -3,
    width: 6,
  },
});
