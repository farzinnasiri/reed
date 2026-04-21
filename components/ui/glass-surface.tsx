import { BlurView } from 'expo-blur';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { canUseGlassBlur, getGlassPaneTokens } from '@/components/ui/glass-material';
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
  const canUseBlur = canUseGlassBlur();
  const pane = getGlassPaneTokens(theme, tone);

  return (
    <View
      style={[
        styles.shell,
        pane.shadowStyle,
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
