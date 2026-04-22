import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  TAB_PILL_MIN_HEIGHT,
  canUseGlassBlur,
  getGlassControlTokens,
  getGlassPaneTokens,
} from '@/components/ui/glass-material';
import { createTiming, getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';

type GlassTabPillItem<T extends string> = {
  accessibilityLabel: string;
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
const SHOULD_USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function GlassTabPill<T extends string>({ items, onPress }: GlassTabPillProps<T>) {
  const { theme } = useReedTheme();
  const pane = getGlassPaneTokens(theme);
  const control = getGlassControlTokens(theme);
  const canUseBlur = canUseGlassBlur();
  const [shellWidth, setShellWidth] = useState(0);
  const activeIndex = Math.max(0, items.findIndex(item => item.isActive));
  const progress = useRef(new Animated.Value(activeIndex)).current;
  const itemWidth = Math.max(0, (shellWidth - SHELL_HORIZONTAL_PADDING * 2) / Math.max(1, items.length));
  const indicatorTranslateX = useMemo(
    () => Animated.multiply(progress, itemWidth || 0),
    [itemWidth, progress],
  );

  useEffect(() => {
    createTiming(progress, activeIndex, reedMotion.durations.standard, undefined, SHOULD_USE_NATIVE_DRIVER).start();
  }, [activeIndex, progress]);

  return (
    <View
      onLayout={event => setShellWidth(event.nativeEvent.layout.width)}
      style={[
        styles.shell,
        pane.shadowStyle,
        {
          backgroundColor: pane.backgroundColor,
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

      {itemWidth > 0 ? (
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              backgroundColor: control.activeBackgroundColor,
              borderColor: control.activeBorderColor,
              transform: [{ translateX: indicatorTranslateX }],
              width: itemWidth,
            },
          ]}
        />
      ) : null}

      <View style={styles.row}>
        {items.map(item => (
          <GlassTabPillButton
            accessibilityLabel={item.accessibilityLabel}
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
  icon,
  index,
  isActive,
  onPress,
  progress,
}: {
  accessibilityLabel: string;
  icon: ReactNode;
  index: number;
  isActive: boolean;
  onPress: () => void;
  progress: Animated.Value;
}) {
  const iconScale = progress.interpolate({
    extrapolate: 'clamp',
    inputRange: [index - 1, index, index + 1],
    outputRange: [1, reedMotion.scale.activeTab, 1],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, getTapScaleStyle(pressed)]}
    >
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>{icon}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 24,
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
  activeIndicator: {
    borderRadius: 16,
    borderWidth: 1,
    bottom: SHELL_VERTICAL_PADDING,
    left: SHELL_HORIZONTAL_PADDING,
    position: 'absolute',
    top: SHELL_VERTICAL_PADDING,
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
});
