import { useEffect, useRef, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { reedMotion, reedSprings } from '@/design/motion';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { usePresenceActivity } from '../presence/use-presence-activity';
import type { ReedMessage } from '../reed.types';
import { ReedWidgetView } from '../widgets/registry';

export function replyRevealDuration() {
  return reedMotion.messageEntry.durationMs;
}

export function ReplyText({ text }: { text: string }) {
  return (
    <ReedText tone="secondary" selectable variant="voice">
      {text}
    </ReedText>
  );
}

export function WidgetEnter({
  fresh,
  message,
}: {
  fresh: boolean;
  message: ReedMessage;
}) {
  const reduced = useReedReducedMotion();
  const active = usePresenceActivity();
  const [initial] = useState(fresh && active);
  const progress = useSharedValue(initial ? 0 : 1);
  const fade = useSharedValue(initial ? 0 : 1);
  const landed = useRef(false);
  useEffect(() => {
    if (!initial) return;
    const delay = reduced ? 0 : replyRevealDuration();
    progress.set(
      withDelay(
        delay,
        reduced
          ? withTiming(1, { duration: reedMotion.reply.reducedMs })
          : withSpring(1, reedSprings.smooth),
      ),
    );
    fade.set(
      withDelay(delay, withTiming(1, { duration: reedMotion.reply.reducedMs })),
    );
    if (!active || landed.current) return;
    const timer = setTimeout(
      () => {
        landed.current = true;
        haptics.light();
      },
      delay +
        (reduced
          ? reedMotion.reply.reducedMs
          : reedMotion.reply.widgetSettleMs),
    );
    return () => clearTimeout(timer);
  }, [active, fade, initial, message.text, progress, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [
      {
        translateY: reduced
          ? 0
          : (1 - progress.get()) * reedMotion.reply.widgetY,
      },
      {
        scale: reduced
          ? 1
          : reedMotion.reply.widgetScale +
            progress.get() * (1 - reedMotion.reply.widgetScale),
      },
    ],
  }));
  return message.widget ? (
    <Animated.View style={style}>
      <ReedWidgetView
        related={message.relatedSession ?? null}
        widget={message.widget}
      />
    </Animated.View>
  ) : null;
}
