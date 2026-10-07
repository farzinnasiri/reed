import {
  createContext,
  useContext,
  useEffect,
  type ComponentProps,
  type ReactNode,
} from "react";
import { View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { ReedText } from "@/components/ui/reed-text";
import { reedMotion, reedSprings } from "@/design/motion";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import { formatMetricValue } from "@/domains/workout/metric-formatting";
import type { RecipeFieldDefinition } from "@/domains/workout/recipes";

export type ReedSwapSnapshot = {
  exerciseId: string;
  title: string;
  metrics: Record<string, number>;
};
const Feedback = createContext<{
  before: ReedSwapSnapshot;
  progress: SharedValue<number>;
} | null>(null);
const Exercise = createContext<string | null>(null);
/** Only confirmed Reed swaps get this feedback. Ordinary logging never enters it. */
export function ReedSwapFeedback({
  before,
  onFinished,
  children,
}: {
  before: ReedSwapSnapshot | null;
  onFinished: () => void;
  children: ReactNode;
}) {
  const progress = useSharedValue(0);
  const reduced = useReedReducedMotion();
  useEffect(() => {
    if (!before) return;
    progress.set(0);
    const timer = setTimeout(() => {
      progress.set(
        reduced
          ? withTiming(
              1,
              {
                duration: reedMotion.reply.reducedMs,
                reduceMotion: ReduceMotion.Never,
              },
              (done) => {
                if (done) scheduleOnRN(onFinished);
              },
            )
          : withSpring(1, reedSprings.smooth, (done) => {
              if (done) scheduleOnRN(onFinished);
            }),
      );
    }, reedMotion.session.appliedHoldMs + reedSprings.sheet.duration);
    return () => clearTimeout(timer);
  }, [before, onFinished, progress, reduced]);
  return (
    <Feedback.Provider value={before ? { before, progress } : null}>
      {children}
    </Feedback.Provider>
  );
}
export function ReedSwapExercise({
  id,
  children,
}: {
  id: string | null;
  children: ReactNode;
}) {
  return <Exercise.Provider value={id}>{children}</Exercise.Provider>;
}
type TextProps = ComponentProps<typeof ReedText> & {
  field?: RecipeFieldDefinition;
};
export function ReedSwapText({ children, field, ...props }: TextProps) {
  const feedback = useContext(Feedback),
    exerciseId = useContext(Exercise);
  const reduced = useReedReducedMotion();
  const active = feedback && feedback.before.exerciseId === exerciseId;
  const old = active
    ? field
      ? feedback.before.metrics[field.key] === undefined
        ? null
        : formatMetricValue(field, feedback.before.metrics[field.key])
      : feedback.before.title
    : null;
  const oldStyle = useAnimatedStyle(() => ({
    opacity: 1 - (feedback?.progress.get() ?? 1),
    transform: [
      {
        translateY: reduced
          ? 0
          : -(feedback?.progress.get() ?? 1) * reedMotion.session.swapRollY,
      },
    ],
  }));
  const newStyle = useAnimatedStyle(() => ({
    opacity: feedback?.progress.get() ?? 1,
    transform: [
      {
        translateY: reduced
          ? 0
          : (1 - (feedback?.progress.get() ?? 1)) *
            reedMotion.session.swapRollY,
      },
    ],
  }));
  if (old === null || old === children)
    return <ReedText {...props}>{children}</ReedText>;
  return (
    <View style={{ overflow: "hidden" }}>
      <Animated.View style={newStyle}>
        <ReedText {...props}>{children}</ReedText>
      </Animated.View>
      <Animated.View
        style={[{ position: "absolute", top: 0, left: 0, right: 0 }, oldStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <ReedText {...props}>{old}</ReedText>
      </Animated.View>
    </View>
  );
}
