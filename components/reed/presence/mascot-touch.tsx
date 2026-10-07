import { useEffect, useRef, type ReactNode } from "react";
import { Platform, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as haptics from "@/design/haptics";
import { reedMotion, reedSprings } from "@/design/motion";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import type { MascotController } from "../mascot";
import { holdPlayback, pickHoldEgg, type HoldEgg } from "./hold-eggs";
import type { ReedPresenceState } from "./presence-state";

// The taps a hold scene can ask for, by name.
const tapHaptics = { light: haptics.light, medium: haptics.medium, selection: haptics.selection, soft: haptics.soft };

export function MascotTouch({
  children,
  mascot,
  state,
  onTalk,
}: {
  children: ReactNode;
  mascot: MascotController;
  state: ReedPresenceState;
  onTalk: () => void;
}) {
  const reduced = useReedReducedMotion();
  const x = useSharedValue(0),
    y = useSharedValue(0),
    sx = useSharedValue(1),
    sy = useSharedValue(1);
  const held = useRef(false),
    suppress = useRef(false);
  const taps = useRef<number[]>([]),
    lastEgg = useRef(0);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The scene playing while held, and the haptic taps still to come.
  const holdEgg = useRef<HoldEgg | null>(null),
    lastHoldEgg = useRef<string | undefined>(undefined),
    holdTaps = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => {
    timeouts.current.forEach(clearTimeout);
    holdTaps.current.forEach(clearTimeout);
  }, []);
  const { gazeX, gazeY } = mascot;
  const pan = Gesture.Pan()
    .minDistance(reedMotion.touch.dragActivation)
    .onUpdate((event) => {
      if (reduced) return;
      const length = Math.hypot(event.translationX, event.translationY);
      const distance = reedMotion.touch.dragMax * (1 - 1 / (length / 60 + 1));
      x.set((event.translationX / Math.max(length, 1)) * distance);
      y.set((event.translationY / Math.max(length, 1)) * distance);
      sx.set(1 + distance / 200);
      sy.set(1 - distance / 300);
      gazeX.set(Math.max(-1, Math.min(1, event.translationX / 60)));
      gazeY.set(Math.max(-1, Math.min(1, event.translationY / 60)));
    })
    .onFinalize(() => {
      x.set(reduced ? 0 : withSpring(0, reedSprings.pop));
      y.set(reduced ? 0 : withSpring(0, reedSprings.pop));
      sx.set(reduced ? 1 : withSpring(1, reedSprings.pop));
      sy.set(reduced ? 1 : withSpring(1, reedSprings.pop));
      gazeX.set(reduced ? 0 : withSpring(0, reedSprings.smooth));
      gazeY.set(reduced ? 0 : withSpring(0.1, reedSprings.smooth));
    });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: reduced ? 0 : x.get() },
      { translateY: reduced ? 0 : y.get() },
      { scaleX: reduced ? 1 : sx.get() },
      { scaleY: reduced ? 1 : sy.get() },
    ],
  }));
  const content = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Talk to Reed"
      accessibilityHint="Focuses the message composer."
      delayLongPress={reedMotion.touch.holdMs}
      onPressIn={() => {
        held.current = false;
        suppress.current = false;
        if (!reduced) {
          sx.set(
            withTiming(reedMotion.touch.pressScale, {
              duration: reedMotion.touch.pressMs,
            }),
          );
          sy.set(
            withTiming(reedMotion.touch.pressScale, {
              duration: reedMotion.touch.pressMs,
            }),
          );
        }
      }}
      onLongPress={() => {
        held.current = true;
        suppress.current = true;
        haptics.soft();
        const egg = pickHoldEgg(Math.random, lastHoldEgg.current);
        holdEgg.current = egg;
        lastHoldEgg.current = egg.id;
        const { steps, taps } = holdPlayback(egg);
        mascot.play(steps);
        holdTaps.current = taps.map(({ at, kind }) => setTimeout(() => tapHaptics[kind](), at));
        if (!reduced) {
          sx.set(withSpring(reedMotion.touch.squishX, reedSprings.pop));
          sy.set(withSpring(reedMotion.touch.squishY, reedSprings.pop));
          y.set(withSpring(reedMotion.touch.squishYpx, reedSprings.pop));
        }
      }}
      onPressOut={() => {
        sx.set(reduced ? 1 : withSpring(1, reedSprings.pop));
        sy.set(reduced ? 1 : withSpring(1, reedSprings.pop));
        y.set(reduced ? 0 : withSpring(0, reedSprings.pop));
        if (held.current) {
          held.current = false;
          holdTaps.current.forEach(clearTimeout);
          holdTaps.current = [];
          haptics.medium();
          mascot.play(holdEgg.current?.outro ?? ["happy"]);
          mascot.act("spring");
        }
      }}
      onPress={() => {
        if (suppress.current) return;
        const now = Date.now();
        taps.current = taps.current
          .filter((at) => now - at < reedMotion.touch.rapidMs)
          .concat(now);
        onTalk();
        if (
          taps.current.length >= 5 &&
          now - lastEgg.current >= reedMotion.touch.cooldownMs
        ) {
          taps.current = [];
          lastEgg.current = now;
          haptics.light();
          mascot.play([
            { expression: "surprised", ms: reedMotion.touch.shakeMs },
            { expression: "dizzy", ms: reedMotion.touch.dizzyMs },
            { expression: "happy", ms: reedMotion.presence.hopMs },
          ]);
          mascot.act("shake");
          timeouts.current.push(
            setTimeout(
              () => mascot.act("hop"),
              reedMotion.touch.shakeMs + reedMotion.touch.dizzyMs,
            ),
          );
        } else {
          haptics.selection();
          mascot.act(state === "thinking" ? "wobble" : "bounce");
        }
      }}
    >
      <Animated.View style={style}>{children}</Animated.View>
    </Pressable>
  );
  return Platform.OS === "web" ? (
    content
  ) : (
    <GestureDetector gesture={pan}>{content}</GestureDetector>
  );
}
