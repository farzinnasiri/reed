import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { reedBodyMetrics, reedOnboardingMetrics } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import BodyViewerDOM from './body-viewer-dom';
import { BASE_APPEARANCE, EMPTY_HIGHLIGHTS, type BodyAppearance, type BodyHighlights, type BodyPick, type BodyStatus, type BodyVariant } from './contract';

export type BodyViewerProps = {
  variant: BodyVariant;
  appearance?: BodyAppearance;
  highlights?: BodyHighlights;
  selected?: string | null;
  view?: 'front' | 'back';
  /** Increment on every shortcut tap, including reselecting Front after a free rotation. */
  viewRequest?: number;
  height?: number;
  onPick?: (pick: BodyPick) => void;
  onStatus?: (status: BodyStatus) => void;
};

/** Native controls remain outside the renderer; props are the reusable muscle/pain contract. */
export function BodyViewer({ variant, appearance = BASE_APPEARANCE, highlights = EMPTY_HIGHLIGHTS, selected = null, view = 'front', viewRequest = 0, height = reedBodyMetrics.viewHeight, onPick, onStatus }: BodyViewerProps) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const [status, setStatus] = useState<BodyStatus>({ state: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  const palette = useMemo(() => ({
    canvas: String(theme.colors.canvas), primary: String(theme.colors.bodyMuscle), secondary: String(theme.colors.dataWarm),
    pending: String(theme.colors.bodyPending),
    pain: [theme.colors.inkMuted, theme.colors.successInk, theme.colors.dataWarm, theme.colors.bodyPainStrong, theme.colors.bodyPainHigh].map(String),
  }), [theme.colors]);
  const viewCommand = useMemo(() => ({ angle: view, request: viewRequest }), [view, viewRequest]);
  return <View style={{ height, width: '100%' }}>
    <BodyViewerDOM key={`${variant}:${retry}`} variant={variant} appearance={appearance} highlights={highlights} selected={selected} view={viewCommand} palette={palette} height={height} active={active} reduced={reduced}
      onPick={async pick => { onPick?.(pick); }} onStatus={async next => { setStatus(next); onStatus?.(next); }}
      dom={{ style: { height, width: '100%', backgroundColor: 'transparent' }, scrollEnabled: false, contentInsetAdjustmentBehavior: 'never' }} />
    {status.state !== 'ready' ? <View style={[StyleSheet.absoluteFill, styles.status, { pointerEvents: 'box-none' }]}>
      {status.state === 'loading' ? <ReedText tone="muted" variant="caption">Loading figure…</ReedText> : <>
        <ReedText tone="muted" variant="caption">Use the area list while the figure is unavailable.</ReedText>
        <Pressable accessibilityRole="button" onPress={() => { setStatus({ state: 'loading' }); setRetry(value => value + 1); }} style={styles.retry}><ReedText tone="accent">Try again</ReedText></Pressable>
      </>}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  status: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  retry: { minHeight: reedOnboardingMetrics.hit, justifyContent: 'center' },
});
