import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';

type AppSplashProps = {
  message?: string;
};

export function AppSplash({ message = 'Opening Reed.' }: AppSplashProps) {
  const { theme } = useReedTheme();

  return (
    <View
      style={[
        styles.screen,
        {
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.xxl,
        },
      ]}
    >
      <View style={styles.identity}>
        <Svg
          accessibilityLabel="Reed logo"
          height={132}
          style={styles.logo}
          viewBox="0 0 100 100"
          width={132}
        >
          <Rect fill={String(theme.colors.textPrimary)} height={38} rx={6} width={12} x={22} y={42} />
          <Rect fill={String(theme.colors.textPrimary)} height={62} rx={6} width={12} x={44} y={18} />
          <Rect fill={String(theme.colors.textPrimary)} height={49} rx={6} width={12} x={66} y={31} />
        </Svg>
        <ReedText variant="brand">reed</ReedText>
      </View>

      <View style={styles.status}>
        <ActivityIndicator color={String(theme.colors.accentPrimary)} />
        <ReedText tone="muted" variant="caption">
          {message}
        </ReedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  identity: {
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    height: 132,
    width: 132,
  },
  status: {
    alignItems: 'center',
    bottom: 56,
    gap: 10,
    position: 'absolute',
  },
});
