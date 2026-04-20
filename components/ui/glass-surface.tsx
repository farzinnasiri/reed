import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useReedTheme } from '@/design/provider';

type GlassSurfaceTone = 'default' | 'danger';

type GlassSurfaceProps = ViewProps & {
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  tone?: GlassSurfaceTone;
};

export function GlassSurface({
  children,
  contentStyle,
  style,
  tone = 'default',
  ...props
}: GlassSurfaceProps) {
  const { theme } = useReedTheme();
  const canUseBlur = Platform.OS === 'ios' || Platform.OS === 'web';
  const palette =
    tone === 'danger'
      ? {
          borderColor: theme.colors.dangerBorder,
          fill: theme.colors.dangerFill,
          gradient: theme.gradients.glassDanger,
        }
      : {
          borderColor: theme.colors.borderSoft,
          fill: theme.colors.glassFallback,
          gradient: theme.gradients.glass,
        };

  return (
    <View
      style={[
        styles.shell,
        theme.shadows.card,
        {
          backgroundColor: palette.fill,
          borderColor: palette.borderColor,
        },
        style,
      ]}
      {...props}
    >
      {canUseBlur ? (
        <BlurView
          intensity={theme.blur.intensity}
          style={StyleSheet.absoluteFill}
          tint={theme.blur.tint}
        />
      ) : null}
      <LinearGradient colors={palette.gradient} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { pointerEvents: 'none' },
          {
            backgroundColor: canUseBlur ? 'transparent' : palette.fill,
            borderColor: theme.colors.glassHighlight,
          },
          styles.highlight,
        ]}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 30,
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
