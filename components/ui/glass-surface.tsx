import { BlurView } from 'expo-blur';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { canUseGlassBlur, getGlassPaneTokens } from '@/components/ui/glass-material';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type GlassSurfaceTone = 'default' | 'danger';

type GlassSurfaceProps = ViewProps & {
  contentStyle?: StyleProp<ViewStyle>;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: GlassSurfaceTone;
};

export function GlassSurface({
  children,
  contentStyle,
  elevated = true,
  style,
  tone = 'default',
  ...props
}: GlassSurfaceProps) {
  const { theme } = useReedTheme();
  const canUseBlur = canUseGlassBlur();
  const pane = getGlassPaneTokens(theme, tone);
  const flattenedShellStyle = StyleSheet.flatten(style);
  const outerBorderRadius =
    typeof flattenedShellStyle?.borderRadius === 'number' ? flattenedShellStyle.borderRadius : reedRadii.xl;
  const wrapperFlexStyle = flattenedShellStyle?.flex !== undefined ? { flex: flattenedShellStyle.flex } : undefined;

  const shell = (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: pane.backgroundColor,
          borderColor: pane.borderColor,
        },
        style,
      ]}
      {...props}
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
          { pointerEvents: 'none' },
          {
            backgroundColor: canUseBlur ? 'transparent' : pane.backgroundColor,
            borderColor: pane.borderColor,
          },
          styles.highlight,
        ]}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );

  if (!elevated) {
    return shell;
  }

  return (
    <View
      style={[
        {
          backgroundColor: String(theme.colors.canvasSecondary),
          borderRadius: outerBorderRadius,
          pointerEvents: 'box-none',
        },
        wrapperFlexStyle,
        pane.shadowStyle,
      ]}
    >
      {shell}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: reedRadii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    borderTopWidth: 1,
    opacity: 0.75,
  },
  content: {
    gap: 14,
    padding: 20,
  },
});
