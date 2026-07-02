import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { canUseGlassBlur, getAndroidGlassBlurProps, getGlassTabPillTokens } from '@/components/ui/glass-material';
import { useGlassBlurTarget } from '@/components/ui/blur-target-context';
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
  const { reducedTransparency, theme } = useReedTheme();
  const blurTarget = useGlassBlurTarget();
  const pane = getGlassTabPillTokens(theme);
  const androidBlurTarget = blurTarget?.isReady ? blurTarget.targetRef : undefined;
  const canUseBlur = canUseGlassBlur({ hasAndroidTarget: Boolean(androidBlurTarget) }) && !reducedTransparency;
  const shellBackground = canUseBlur ? pane.backgroundColor : pane.fallbackBackgroundColor;

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
          pane.shadowStyle,
          {
            backgroundColor: shellBackground,
            borderColor: pane.borderColor,
          },
        ]}
      >
        {canUseBlur ? (
          <BlurView
            {...getAndroidGlassBlurProps(androidBlurTarget)}
            intensity={pane.blurIntensity}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            tint={theme.blur.tint}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.headerHighlight,
            {
              backgroundColor: canUseBlur ? 'transparent' : shellBackground,
              borderColor: pane.borderColor,
            },
          ]}
        />
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
