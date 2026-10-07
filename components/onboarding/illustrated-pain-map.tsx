import { useRef } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useReedTheme } from '@/design/provider';
import { reedRadii, reedOnboardingMetrics } from '@/design/system';
import type { BodyPain } from './draft';

type Angle = BodyPain['view'];
type Region = { area: string; x: number; y: number };

function regions(view: Angle): Region[] {
  const result: Region[] = [{ area: 'Neck', x: .5, y: .17 },
    ...(view === 'back' ? [{ area: 'Upper back', x: .5, y: .3 }, { area: 'Lower back', x: .5, y: .46 }] : [{ area: 'Chest', x: .5, y: .29 }, { area: 'Abdomen', x: .5, y: .43 }])];
  const parts = [['shoulder', .25, .25], ['elbow', .15, .38], ['forearm', .135, .44], ['wrist', .12, .5], ['hand', .11, .56], [view === 'front' ? 'hip' : 'glute', .36, .53], [view === 'front' ? 'front thigh' : 'back thigh', .34, .62], [view === 'front' ? 'knee' : 'back of knee', .32, .71], [view === 'front' ? 'shin' : 'calf', .3, .82], ['ankle', .29, .91], [view === 'front' ? 'foot' : 'heel', .27, .97]] as const;
  for (const [part, x, y] of parts) {
    result.push({ area: `${view === 'front' ? 'Right' : 'Left'} ${part}`, x, y });
    result.push({ area: `${view === 'front' ? 'Left' : 'Right'} ${part}`, x: 1 - x, y });
  }
  return result;
}


// Neutral cutout only: selection and severity are owned by the shared BodyMap.
const ATLAS = { width: 1024, height: 1536, columns: [208, 584], top: 1028, frameWidth: 240, frameHeight: 504 };
export function NeutralBodyFigure({ height, view, pain, selected, onPick }: {
  height: number; view: Angle; pain: Record<string, BodyPain>; selected: BodyPain | null;
  onPick: (pick: Pick<BodyPain, 'area' | 'view' | 'x' | 'y'>) => void;
}) {
  const { theme } = useReedTheme();
  const figureRef = useRef<View>(null);
  const colors = [theme.colors.inkMuted, theme.colors.successInk, theme.colors.dataWarm, theme.colors.bodyPainStrong, theme.colors.bodyPainHigh];
  const scale = height / ATLAS.frameHeight;
  const width = ATLAS.frameWidth * scale;
  const radius = width * .14;
  const artStyle = { position: 'absolute' as const, width: ATLAS.width * scale, height: ATLAS.height * scale, left: -ATLAS.columns[view === 'front' ? 0 : 1] * scale, top: -ATLAS.top * scale };
  const points = [...Object.values(pain).filter(p => p.view === view && p.area !== selected?.area), ...(selected?.view === view && selected.intensity !== 0 ? [selected] : [])];
  return <View style={styles.figureRow}>
    <Pressable ref={figureRef} accessible={false} style={{ height, width }} onPress={event => {
      const { pageX, pageY } = event.nativeEvent;
      figureRef.current?.measureInWindow((left, top, measuredWidth, measuredHeight) => {
        const x = (pageX - left) / measuredWidth, y = (pageY - top) / measuredHeight;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const region = regions(view).sort((a,b) => Math.hypot((a.x-x)*measuredWidth,(a.y-y)*measuredHeight)-Math.hypot((b.x-x)*measuredWidth,(b.y-y)*measuredHeight))[0];
        onPick({ ...region, view });
      });
    }}>
      <View style={[styles.crop, { height, width, pointerEvents: 'none' }]}><Image accessible={false} source={require('@/assets/onboarding/body-atlas-v2.png')} style={artStyle} resizeMode="stretch" /></View>
      {points.map(point => {
        const color = colors[point.intensity] ?? theme.colors.bodyPending;
        const x = point.x * width, y = point.y * height;
        return <View key={point.area} style={[styles.tint, { left: x-radius, top: y-radius, width: radius*2, height: radius*2, pointerEvents: 'none' }]}><Image accessible={false} source={require('@/assets/onboarding/body-atlas-v2.png')} resizeMode="stretch" style={[artStyle, { left: artStyle.left-x+radius, top: artStyle.top-y+radius, tintColor: color }]} /></View>;
      })}
    </Pressable>
    {points.map(point => <Pressable key={point.area} accessibilityRole="button" accessibilityLabel={`Edit ${point.area}`} onPress={() => onPick(point)} style={[styles.spotTouch, { left: '50%', marginLeft: (point.x-.5)*width-reedOnboardingMetrics.hit/2, top: point.y*height-reedOnboardingMetrics.hit/2 }]}><View style={[styles.pin, { backgroundColor: colors[point.intensity] ?? theme.colors.bodyPending, borderColor: selected?.area === point.area ? theme.colors.ink : theme.colors.canvas }]} /></Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  figureRow: { alignItems: 'center', justifyContent: 'center' },
  crop: { overflow: 'hidden' },
  tint: { position: 'absolute', borderRadius: reedRadii.pill, overflow: 'hidden', opacity: .7 },
  spotTouch: { position: 'absolute', width: reedOnboardingMetrics.hit, height: reedOnboardingMetrics.hit, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 14, height: 14, borderRadius: reedRadii.pill, borderWidth: 2 },
});
