import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { BODY_SHAPES, BODY_SHAPE_IMAGES, type BodyShape, type Sex } from './content';

const PAGE_IMAGE_HEIGHT = 292;

/** Swipe through body shapes with their approximate body fat; the one you stop on is the answer. */
export function ShapeCarousel({ onChange, sex, value }: { onChange: (shape: BodyShape) => void; sex: Sex | null; value: BodyShape | null }) {
  const { theme } = useReedTheme();
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const startIndex = Math.max(0, BODY_SHAPES.findIndex(shape => shape.value === (value ?? 'average_lean')));
  const [active, setActive] = useState(startIndex);
  const last = useRef(startIndex);
  const ready = useRef(false);
  const set = sex === 'female' ? 'female' : 'male';

  useEffect(() => {
    if (!width) return;
    scroll.current?.scrollTo({ animated: false, x: startIndex * width });
    const timer = setTimeout(() => {
      ready.current = true;
    }, 450);
    return () => clearTimeout(timer);
    // Positioned once, when the width is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const go = (index: number) => scroll.current?.scrollTo({ animated: true, x: Math.max(0, Math.min(BODY_SHAPES.length - 1, index)) * width });
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const index = Math.max(0, Math.min(BODY_SHAPES.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
    if (index === last.current) return;
    last.current = index;
    setActive(index);
    if (!ready.current) return;
    haptics.selection();
    onChange(BODY_SHAPES[index].value);
  };

  const shape = BODY_SHAPES[active];
  const imageWidth = Math.round(PAGE_IMAGE_HEIGHT / 1.5);
  return (
    <View style={styles.shapeRoot}>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.shapeStage}>
        <ScrollView horizontal onScroll={onScroll} pagingEnabled ref={scroll} scrollEventThrottle={16} showsHorizontalScrollIndicator={false}>
          {BODY_SHAPES.map(entry => (
            <View key={entry.value} style={[styles.shapePage, { width }]}>
              <Image resizeMode="cover" source={BODY_SHAPE_IMAGES[set][entry.value]} style={{ borderRadius: reedRadii.lg, height: PAGE_IMAGE_HEIGHT, width: imageWidth }} />
            </View>
          ))}
        </ScrollView>
        <Pressable accessibilityLabel="Previous shape" disabled={active === 0} hitSlop={8} onPress={() => go(active - 1)} style={[styles.arrow, { left: 0, opacity: active === 0 ? 0.25 : 1 }]}>
          <Ionicons color={String(theme.colors.inkSecondary)} name="chevron-back" size={22} />
        </Pressable>
        <Pressable accessibilityLabel="Next shape" disabled={active === BODY_SHAPES.length - 1} hitSlop={8} onPress={() => go(active + 1)} style={[styles.arrow, { opacity: active === BODY_SHAPES.length - 1 ? 0.25 : 1, right: 0 }]}>
          <Ionicons color={String(theme.colors.inkSecondary)} name="chevron-forward" size={22} />
        </Pressable>
      </View>
      <View style={styles.shapeCaption}>
        <ReedText variant="headline">{shape.label}</ReedText>
        <ReedText tone="muted" variant="caption">About {shape.fat[set]} body fat</ReedText>
      </View>
      <View style={styles.dots}>
        {BODY_SHAPES.map((entry, index) => (
          <View key={entry.value} style={[styles.pageDot, { backgroundColor: index === active ? theme.colors.accent : theme.colors.lineStrong, width: index === active ? 16 : 6 }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shapeRoot: {
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  shapeStage: {
    height: PAGE_IMAGE_HEIGHT,
    width: '100%',
  },
  shapePage: {
    alignItems: 'center',
    height: PAGE_IMAGE_HEIGHT,
    justifyContent: 'center',
  },
  arrow: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    top: PAGE_IMAGE_HEIGHT / 2 - 22,
    width: 44,
  },
  shapeCaption: {
    alignItems: 'center',
    gap: 2,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  pageDot: {
    borderRadius: reedRadii.pill,
    height: 6,
  },
});
