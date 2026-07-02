import { View } from 'react-native';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { styles } from './reed.styles';

export function ReedHeader({
  label,
  topInset,
}: {
  label: string;
  topInset: number;
}) {
  const { theme } = useReedTheme();
  const controls = getGlassControlTokens(theme);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.fixedHeader,
        {
          paddingTop: topInset,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          controls.shadowStyle,
          {
            backgroundColor: controls.shellBackgroundColor,
            borderColor: controls.shellBorderColor,
          },
        ]}
      >
        <View style={styles.headerIdentity}>
          <View style={[styles.headerAvatar, { backgroundColor: theme.colors.accentPrimary }]}>
            <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="caption">R</ReedText>
          </View>
          <ReedText variant="section">Reed</ReedText>
        </View>
        <View style={styles.headerPresence}>
          <ReedText tone="muted" variant="caption">{label}</ReedText>
        </View>
      </View>
    </View>
  );
}
