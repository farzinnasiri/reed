// ---------------------------------------------------------------------------
// Step: Body Type — visual starting-point picker.
// The stored value is the visual preset, not the old coarse physique bucket.
// ---------------------------------------------------------------------------

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { OnboardingShell } from './onboarding-shell';
import type { BodyType, GenderIdentity, OnboardingDraft } from './types';

type BodyTypeOption = {
  bodyFatRange: Record<'female' | 'male', string>;
  label: string;
  subtitle: string;
  value: BodyType;
};

const BODY_TYPE_OPTIONS: readonly BodyTypeOption[] = [
  {
    bodyFatRange: { female: '16-19%', male: '8-11%' },
    label: 'Very lean',
    subtitle: 'Low body fat with clear definition.',
    value: 'very_lean',
  },
  {
    bodyFatRange: { female: '20-23%', male: '12-15%' },
    label: 'Lean',
    subtitle: 'Slim, lightly defined, not bulky.',
    value: 'lean',
  },
  {
    bodyFatRange: { female: '24-27%', male: '16-19%' },
    label: 'Average lean',
    subtitle: 'Mostly lean with some softness.',
    value: 'average_lean',
  },
  {
    bodyFatRange: { female: '28-31%', male: '20-23%' },
    label: 'Soft middle',
    subtitle: 'Smaller frame with more softness at the waist.',
    value: 'soft_middle',
  },
  {
    bodyFatRange: { female: '32-35%', male: '24-27%' },
    label: 'Average',
    subtitle: 'Moderate body fat and little definition.',
    value: 'average',
  },
  {
    bodyFatRange: { female: '36-40%', male: '28-32%' },
    label: 'High fat',
    subtitle: 'Higher body fat across the torso and limbs.',
    value: 'high_fat',
  },
  {
    bodyFatRange: { female: '41-46%', male: '33-38%' },
    label: 'Larger high fat',
    subtitle: 'Larger body with high body fat.',
    value: 'larger_high_fat',
  },
  {
    bodyFatRange: { female: '24-30%', male: '16-22%' },
    label: 'Muscular solid',
    subtitle: 'Muscle and size with some softness.',
    value: 'muscular_solid',
  },
  {
    bodyFatRange: { female: '18-23%', male: '10-15%' },
    label: 'Athletic muscular',
    subtitle: 'Clearly trained, lean, and muscular.',
    value: 'athletic_muscular',
  },
] as const;

const BODY_TYPE_INDEX = new Map(BODY_TYPE_OPTIONS.map((option, index) => [option.value, index]));

const BODY_TYPE_IMAGES: Record<'female' | 'male', Record<BodyType, ImageSourcePropType>> = {
  female: {
    athletic_muscular: require('../../assets/images/onboarding/body-types/female/athletic-muscular.webp'),
    average: require('../../assets/images/onboarding/body-types/female/average.webp'),
    average_lean: require('../../assets/images/onboarding/body-types/female/average-lean.webp'),
    high_fat: require('../../assets/images/onboarding/body-types/female/high-fat.webp'),
    larger_high_fat: require('../../assets/images/onboarding/body-types/female/larger-high-fat.webp'),
    lean: require('../../assets/images/onboarding/body-types/female/lean.webp'),
    muscular_solid: require('../../assets/images/onboarding/body-types/female/muscular-solid.webp'),
    soft_middle: require('../../assets/images/onboarding/body-types/female/soft-middle.webp'),
    very_lean: require('../../assets/images/onboarding/body-types/female/very-lean.webp'),
  },
  male: {
    athletic_muscular: require('../../assets/images/onboarding/body-types/male/athletic-muscular.webp'),
    average: require('../../assets/images/onboarding/body-types/male/average.webp'),
    average_lean: require('../../assets/images/onboarding/body-types/male/average-lean.webp'),
    high_fat: require('../../assets/images/onboarding/body-types/male/high-fat.webp'),
    larger_high_fat: require('../../assets/images/onboarding/body-types/male/larger-high-fat.webp'),
    lean: require('../../assets/images/onboarding/body-types/male/lean.webp'),
    muscular_solid: require('../../assets/images/onboarding/body-types/male/muscular-solid.webp'),
    soft_middle: require('../../assets/images/onboarding/body-types/male/soft-middle.webp'),
    very_lean: require('../../assets/images/onboarding/body-types/male/very-lean.webp'),
  },
};

type StepBodyTypeProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  draft: OnboardingDraft;
  onBack: () => void;
  onCancel?: () => Promise<void> | void;
  onContinue: () => void;
  onUpdateDraft: (patch: Partial<OnboardingDraft>) => void;
  stepCount: number;
  stepIndex: number;
};

export function StepBodyType({
  backPlacement,
  cancelLabel,
  draft,
  onBack,
  onCancel,
  onContinue,
  onUpdateDraft,
  stepCount,
  stepIndex,
}: StepBodyTypeProps) {
  const { theme } = useReedTheme();
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const draftIndex = draft.bodyType ? BODY_TYPE_INDEX.get(draft.bodyType) ?? 2 : 2;
  const [activeIndex, setActiveIndex] = useState(draftIndex);
  const [stageWidth, setStageWidth] = useState(0);
  const imageSet = getImageSet(draft.genderIdentity);
  const imageWidth = Math.round(Math.min(Math.max(width - theme.spacing.lg * 4, 248), 360, height * 0.32));
  const imageHeight = Math.round(imageWidth * 1.5);
  const selectedOption = BODY_TYPE_OPTIONS[activeIndex];

  const pageOffsets = useMemo(
    () => BODY_TYPE_OPTIONS.map((_, index) => index * stageWidth),
    [stageWidth],
  );

  useEffect(() => {
    if (!stageWidth) {
      return;
    }
    scrollRef.current?.scrollTo({ animated: false, x: draftIndex * stageWidth });
  }, [draftIndex, stageWidth]);

  useEffect(() => {
    setActiveIndex(draftIndex);
  }, [draftIndex]);

  useEffect(() => {
    if (!draft.bodyType) {
      onUpdateDraft({ bodyType: BODY_TYPE_OPTIONS[draftIndex].value });
    }
  }, [draft.bodyType, draftIndex, onUpdateDraft]);

  function selectIndex(index: number) {
    const option = BODY_TYPE_OPTIONS[index];
    if (!option || !stageWidth) {
      return;
    }
    setActiveIndex(index);
    if (option.value !== draft.bodyType) {
      onUpdateDraft({ bodyType: option.value });
    }
    scrollRef.current?.scrollTo({ animated: true, x: index * stageWidth });
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!stageWidth) {
      return;
    }
    const nextIndex = getNearestIndex(event.nativeEvent.contentOffset.x, stageWidth);
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!stageWidth) {
      return;
    }
    const nextIndex = getNearestIndex(event.nativeEvent.contentOffset.x, stageWidth);
    const nextValue = BODY_TYPE_OPTIONS[nextIndex]?.value;
    setActiveIndex(nextIndex);
    if (nextValue && nextValue !== draft.bodyType) {
      onUpdateDraft({ bodyType: nextValue });
    }
  }

  const canGoBack = activeIndex > 0;
  const canGoForward = activeIndex < BODY_TYPE_OPTIONS.length - 1;

  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onBack={onBack}
      onCancel={onCancel}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">
          Pick the closest starting point
        </ReedText>
        <ReedText tone="muted">
          Swipe through the images. Choose the closest match, not a perfect one.
        </ReedText>
      </View>

      <View
        onLayout={event => setStageWidth(event.nativeEvent.layout.width)}
        style={styles.stage}
      >
        {stageWidth ? (
          <ScrollView
            decelerationRate="fast"
            horizontal
            onScroll={handleScroll}
            onMomentumScrollEnd={handleScrollEnd}
            onScrollEndDrag={handleScrollEnd}
            pagingEnabled
            ref={scrollRef}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            snapToOffsets={pageOffsets}
            style={styles.carousel}
          >
            {BODY_TYPE_OPTIONS.map(option => (
              <View
                key={option.value}
                style={[styles.slide, { width: stageWidth }]}
              >
                <View
                  style={[
                    styles.imageFrame,
                    {
                      backgroundColor: theme.colors.controlFill,
                      borderColor: theme.colors.controlBorder,
                      height: imageHeight,
                      width: imageWidth,
                    },
                  ]}
                >
                  <Image
                    accessibilityIgnoresInvertColors
                    resizeMode="cover"
                    source={BODY_TYPE_IMAGES[imageSet][option.value]}
                    style={styles.bodyImage}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View
          style={[
            styles.arrowLayer,
            {
              pointerEvents: 'box-none',
              top: Math.round(imageHeight / 2) - 22,
              width: Math.min(stageWidth || width, imageWidth + 104),
            },
          ]}
        >
          <ArrowButton
            accessibilityLabel="Previous body type"
            disabled={!canGoBack}
            iconName="chevron-back"
            onPress={() => selectIndex(activeIndex - 1)}
          />
          <ArrowButton
            accessibilityLabel="Next body type"
            disabled={!canGoForward}
            iconName="chevron-forward"
            onPress={() => selectIndex(activeIndex + 1)}
          />
        </View>

        <View style={styles.detailBlock}>
          <ReedText variant="section">{selectedOption.label}</ReedText>
          <ReedText tone="muted">{selectedOption.subtitle}</ReedText>
          <ReedText tone="muted" variant="caption">
            Approx. {selectedOption.bodyFatRange[imageSet]} body fat
          </ReedText>
        </View>

        <View
          accessibilityLabel={`Body type ${activeIndex + 1} of ${BODY_TYPE_OPTIONS.length}`}
          style={styles.dots}
        >
          {BODY_TYPE_OPTIONS.map((option, index) => {
            const isActive = index === activeIndex;
            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={option.value}
                onPress={() => selectIndex(index)}
                style={({ pressed }) => [
                  styles.dotHitArea,
                  getTapScaleStyle(pressed),
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isActive ? theme.colors.accentPrimary : theme.colors.borderSoft,
                      width: isActive ? 18 : 6,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingShell>
  );
}

function getImageSet(genderIdentity: GenderIdentity | null): 'female' | 'male' {
  return genderIdentity === 'female' ? 'female' : 'male';
}

function getNearestIndex(offsetX: number, pageWidth: number) {
  return Math.max(
    0,
    Math.min(BODY_TYPE_OPTIONS.length - 1, Math.round(offsetX / pageWidth)),
  );
}

function ArrowButton({
  accessibilityLabel,
  disabled,
  iconName,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  iconName: 'chevron-back' | 'chevron-forward';
  onPress: () => void;
}) {
  const { theme } = useReedTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrowButton,
        {
          backgroundColor: theme.colors.controlFill,
          borderColor: theme.colors.controlBorder,
          opacity: disabled ? 0.32 : 1,
        },
        getTapScaleStyle(pressed, disabled),
      ]}
    >
      <Ionicons color={String(theme.colors.textPrimary)} name={iconName} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  stage: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    minHeight: 500,
    position: 'relative',
  },
  carousel: {
    alignSelf: 'stretch',
    flexGrow: 0,
  },
  slide: {
    alignItems: 'center',
  },
  imageFrame: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bodyImage: {
    height: '100%',
    width: '100%',
  },
  detailBlock: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 360,
    minHeight: 82,
    paddingHorizontal: 12,
  },
  arrowLayer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
  },
  arrowButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dotHitArea: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 28,
  },
  dot: {
    borderRadius: reedRadii.pill,
    height: 6,
  },
});
