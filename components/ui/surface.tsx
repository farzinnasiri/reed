import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type SurfaceTone = 'default' | 'danger';

type SurfaceProps = ViewProps & {
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  tone?: SurfaceTone;
};

export function Surface({
  children,
  contentStyle,
  style,
  tone = 'default',
  ...props
}: SurfaceProps) {
  const { theme } = useReedTheme();

  return (
    <View
      style={[
        styles.shell,
        { backgroundColor: tone === 'danger' ? theme.colors.dangerFill : theme.colors.surface },
        style,
      ]}
      {...props}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: reedRadii.card,
    overflow: 'hidden',
  },
  content: {
    gap: 14,
    padding: 20,
  },
});
