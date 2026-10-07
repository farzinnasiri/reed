import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BodyViewer } from '@/components/body-3d/body-viewer';
import { BODY_REGIONS, regionByLabel, type BodyPick } from '@/components/body-3d/contract';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedBodyMetrics as metrics, reedOnboardingMetrics, reedRadii } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { onboardingAppearance } from './body-appearance';
import type { BodyShape, Sex } from './content';
import type { BodyPain } from './draft';
import { NeutralBodyFigure } from './illustrated-pain-map';
import { useOnboardingReed } from './reed-context';
import { PAIN_LABELS, VerticalPainScale } from './vertical-pain-scale';
export { PAIN_LABELS } from './vertical-pain-scale';

export function BodyMap({ availableHeight, onChange, pain, sex, shape }: {
  availableHeight: number;
  onChange: (pain: Record<string, BodyPain>) => void;
  pain: Record<string, BodyPain>; sex: Sex | null; shape: BodyShape | null;
}) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const { height: viewportHeight } = useWindowDimensions();
  const [view, setView] = useState<'front' | 'back'>('front');
  const [viewRequest, setViewRequest] = useState(0);
  const [selected, setSelected] = useState<BodyPain | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const editing = selected !== null;
  const areaScroll = useRef<ScrollView>(null);
  const points = Object.values(pain).map(point => selected?.area === point.area ? selected : point);
  if (selected && !pain[selected.area]) points.push(selected);
  const lowerDesired = listOpen ? reedOnboardingMetrics.bodyPickerHeight : Math.min(points.length * reedOnboardingMetrics.hit, reedOnboardingMetrics.bodySelectedHeight);
  const gap = theme.spacing.xs;
  const controlsHeight = reedOnboardingMetrics.hit;
  const gaps = gap * (lowerDesired ? 2 : 1);
  const shift = useSharedValue(0);
  // Budget against the measured stage and heading, rather than the full screen.
  // Only very short screens need the outer onboarding scroll view.
  const budget = availableHeight > 0 ? availableHeight : (viewportHeight <= reedOnboardingMetrics.compactHeight ? reedOnboardingMetrics.compactBodyHeight : reedOnboardingMetrics.bodyHeight) + controlsHeight + gaps + lowerDesired;
  const height = Math.max(reedOnboardingMetrics.bodyMinHeight, Math.min(reedOnboardingMetrics.bodyMaxHeight, budget - controlsHeight - gaps - lowerDesired));
  const lowerHeight = lowerDesired ? Math.max(reedOnboardingMetrics.hit, Math.min(lowerDesired, budget - height - controlsHeight - gaps)) : 0;
  const selectedIndex = points.findIndex(point => point.area === selected?.area);
  useEffect(() => {
    areaScroll.current?.scrollTo({ y: listOpen ? 0 : Math.max(0, (selectedIndex + 1) * reedOnboardingMetrics.hit - lowerHeight), animated: !reduced });
  }, [listOpen, lowerHeight, reduced, selectedIndex]);
  const { setAnswerPending } = useOnboardingReed();
  useEffect(() => {
    setAnswerPending(selected !== null && !pain[selected.area]);
    return () => setAnswerPending(false);
  }, [pain, selected, setAnswerPending]);
  useEffect(() => {
    shift.value = reduced ? Number(editing) : withSpring(Number(editing), reedSprings.morph);
  }, [editing, reduced, shift]);
  const figureStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -shift.value * (metrics.severityWidth + metrics.severityGap) / 2 }] }));
  const severityStyle = useAnimatedStyle(() => ({ opacity: shift.value, transform: [{ translateX: (1 - shift.value) * metrics.severityWidth }] }));
  const appearance = useMemo(() => onboardingAppearance(shape), [shape]);
  const highlights = useMemo(() => {
    const shown = { ...pain };
    // Preview changes the displayed patch. The draft is committed on release.
    if (selected && selected.intensity >= 0) shown[selected.area] = selected;
    return { primary: [], secondary: [], pain: Object.fromEntries(Object.values(shown).flatMap(point => {
      const region = regionByLabel.get(point.area);
      return region ? [[region.id, point.intensity]] : [];
    })) };
  }, [pain, selected]);
  const select = (pick: Pick<BodyPick, 'area' | 'view' | 'x' | 'y'>) => {
    haptics.selection();
    setSelected({ ...pick, intensity: pain[pick.area]?.intensity ?? -1 });
    setListOpen(false);
  };
  const previewIntensity = useCallback((intensity: number) => setSelected(previous => previous ? { ...previous, intensity } : null), []);
  const chooseIntensity = (intensity: number) => {
    if (!selected) return;
    const next = { ...pain };
    if (intensity === 0) delete next[selected.area];
    else next[selected.area] = { ...selected, intensity };
    setSelected(intensity === 0 ? null : { ...selected, intensity });
    onChange(next);
  };
  const remove = (area: string) => {
    haptics.selection();
    const next = { ...pain };
    delete next[area];
    if (selected?.area === area) setSelected(null);
    onChange(next);
  };
  const severityColors = [theme.colors.inkMuted, theme.colors.successInk, theme.colors.dataWarm, theme.colors.bodyPainStrong, theme.colors.bodyPainHigh];
  const neutral = sex === 'other' || sex === 'private';
  return <View style={[styles.root, { gap }]}>
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={[StyleSheet.absoluteFill, figureStyle]}>
        {neutral ? <NeutralBodyFigure height={height} view={view} pain={pain} selected={selected} onPick={select} /> : <BodyViewer variant={sex === 'female' ? 'female' : 'male'} height={height} appearance={appearance} highlights={highlights} selected={selected && selected.intensity < 0 ? regionByLabel.get(selected.area)?.id : null} view={view} viewRequest={viewRequest} onPick={select} />}
      </Animated.View>
      <Animated.View style={[styles.severity, severityStyle, { pointerEvents: editing ? 'auto' : 'none' }]} accessibilityElementsHidden={!editing} importantForAccessibility={editing ? 'auto' : 'no-hide-descendants'}>
        {selected ? <VerticalPainScale area={selected.area} value={selected.intensity < 0 ? null : selected.intensity} height={height - reedOnboardingMetrics.hit} onPreview={previewIntensity} onChange={chooseIntensity} /> : null}
      </Animated.View>
    </View>
    <View style={[styles.controls, { gap }]}>
      <ReedText tone="secondary" variant="caption" style={styles.areaHeading} accessibilityLiveRegion="polite">{points.length ? `Selected areas (${points.length})` : ''}</ReedText>
      <Pressable accessibilityRole="button" accessibilityLabel={view === 'front' ? 'Rotate to back' : 'Rotate to front'} onPress={() => { haptics.selection(); setView(view === 'front' ? 'back' : 'front'); setViewRequest(previous => previous + 1); }} style={styles.iconButton}><Ionicons name="sync-outline" size={24} color={String(theme.colors.inkSecondary)} /></Pressable>
      <Pressable accessibilityLabel={listOpen ? 'Close area list' : 'Choose body area from list'} accessibilityRole="button" accessibilityState={{ expanded: listOpen }} onPress={() => { haptics.selection(); setListOpen(!listOpen); }} style={[styles.addButton, { gap: theme.spacing.xxs }]}>
        <Ionicons name={listOpen ? 'close' : 'add-outline'} size={20} color={String(theme.colors.inkSecondary)} /><ReedText tone="secondary" variant="caption">{listOpen ? 'Done' : 'Add area'}</ReedText>
      </Pressable>
    </View>
    {lowerHeight ? <ScrollView ref={areaScroll} style={{ height: lowerHeight, flexGrow: 0 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
      {!listOpen ? points.map(point => {
        const active = selected?.area === point.area;
        const color = point.intensity < 0 ? theme.colors.bodyPending : severityColors[point.intensity];
        const severity = point.intensity < 0 ? 'Choose severity' : PAIN_LABELS[point.intensity];
        return <View key={point.area} style={styles.selectedRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${point.area}, ${severity}`} accessibilityState={{ selected: active }} onPress={() => select(point)} style={[styles.selectedArea, { gap: theme.spacing.xs }]}>
            <View style={[styles.colorDot, { backgroundColor: color }]} />
            <ReedText variant={active ? 'bodyStrong' : 'body'} style={styles.areaLabel}>{point.area}</ReedText>
            <ReedText variant="caption" style={{ color }}>{severity}</ReedText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${point.area}`} onPress={() => remove(point.area)} style={styles.iconButton}><Ionicons name="close" size={18} color={String(theme.colors.inkMuted)} /></Pressable>
          <View style={[styles.divider, { backgroundColor: theme.colors.line, pointerEvents: 'none' }]} />
        </View>;
      }) : null}
      {listOpen ? <>
        {BODY_REGIONS.map(region => {
          const chosen = points.find(point => point.area === region.storedAreaLabel);
          const color = chosen ? chosen.intensity < 0 ? theme.colors.bodyPending : severityColors[chosen.intensity] : theme.colors.inkMuted;
          return <Pressable key={region.id} accessibilityRole="button" accessibilityLabel={`Choose ${region.label}`} accessibilityState={{ selected: !!chosen }} onPress={() => select(chosen ?? { area: region.storedAreaLabel, view, x: .5, y: .5 })} style={[styles.area, { gap: theme.spacing.xs, borderBottomColor: theme.colors.line }]}>
            <ReedText style={styles.areaLabel}>{region.label}</ReedText>
            {chosen ? <ReedText variant="caption" style={{ color }}>{chosen.intensity < 0 ? 'Choose severity' : PAIN_LABELS[chosen.intensity]}</ReedText> : null}
            <Ionicons name={chosen ? 'checkmark' : 'add-outline'} size={18} color={String(color)} />
          </Pressable>;
        })}
      </> : null}
    </ScrollView> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  severity: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center' },
  areaHeading: { flex: 1 },
  areaLabel: { flex: 1, flexShrink: 1 },
  iconButton: { width: reedOnboardingMetrics.hit, minHeight: reedOnboardingMetrics.hit, alignItems: 'center', justifyContent: 'center' },
  addButton: { minHeight: reedOnboardingMetrics.hit, flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 8, height: 8, borderRadius: reedRadii.pill },
  selectedArea: { flex: 1, minHeight: reedOnboardingMetrics.hit, flexDirection: 'row', alignItems: 'center' },
  selectedRow: { minHeight: reedOnboardingMetrics.hit, flexDirection: 'row', alignItems: 'center' },
  divider: { position: 'absolute', bottom: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  area: { minHeight: reedOnboardingMetrics.hit, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
