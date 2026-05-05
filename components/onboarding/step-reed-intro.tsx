import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { FIRST_EXPERIENCE_REED_MARK_ROOT_TOP, FIRST_EXPERIENCE_REED_MARK_SIZE } from './first-experience-layout';

type StepReedIntroProps = {
  displayName: string;
  onBack: () => void;
  onContinue: () => void;
};

type IntroMessage = {
  emphasis?: boolean;
  id: string;
  text: string;
};

const MESSAGE_DELAY_MS = 1450;
const INTRO_START_DELAY_MS = 900;
const CTA_DELAY_MS = 900;
export function StepReedIntro({ displayName, onBack, onContinue }: StepReedIntroProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const firstName = displayName.trim().split(/\s+/)[0] || 'there';
  const messages = useMemo<IntroMessage[]>(
    () => [
      { emphasis: true, id: 'set', text: `Congrats, ${firstName}. That was your first set here.` },
      { id: 'name', text: "By the way, I'm Reed. Nice to meet you. ♥" },
      { id: 'context', text: "Before we go further, I'd like to ask a few things, if that's okay." },
      { id: 'profile', text: "Nothing heavy. Just enough to understand where you're starting." },
    ],
    [firstName],
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const [showCta, setShowCta] = useState(false);
  const ctaProgress = useRef(new Animated.Value(0)).current;
  // Chrome (header) fades in so the R avatar visually persists from the
  // gesture-demo step without a gap.
  const chromeProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    ctaProgress.setValue(0);
    chromeProgress.setValue(0);
    setVisibleCount(0);
    setShowCta(false);

    // Fade the header chrome in after a tiny beat so the R avatar appears to
    // persist seamlessly from the previous step while surrounding UI arrives.
    const chromeTimer = setTimeout(() => {
      createTiming(chromeProgress, 1, reedMotion.durations.mode).start();
    }, 60);

    const timers = messages.map((_, index) =>
      setTimeout(() => {
        setVisibleCount(index + 1);
      }, INTRO_START_DELAY_MS + MESSAGE_DELAY_MS * index),
    );
    const ctaTimer = setTimeout(() => {
      setShowCta(true);
      createTiming(ctaProgress, 1, reedMotion.durations.mode + 320).start();
    }, INTRO_START_DELAY_MS + MESSAGE_DELAY_MS * messages.length + CTA_DELAY_MS);

    return () => {
      clearTimeout(chromeTimer);
      timers.forEach(clearTimeout);
      clearTimeout(ctaTimer);
    };
  }, [ctaProgress, chromeProgress, messages]);

  const ctaY = ctaProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  // The thread starts below the avatar. Both use root-level absolute
  // coordinates so no onLayout measurement is needed.
  const threadTop = FIRST_EXPERIENCE_REED_MARK_ROOT_TOP + FIRST_EXPERIENCE_REED_MARK_SIZE + 42;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.canvas,
          paddingBottom: insets.bottom + theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      {/* R avatar — positioned absolutely from root top so it is visible on
          the very first frame with zero measurement latency. It starts at full
          opacity because it's already on-screen from the gesture-demo step. */}
      <View
        style={[
          styles.presence,
          {
            top: FIRST_EXPERIENCE_REED_MARK_ROOT_TOP,
            shadowColor: String(theme.colors.accentPrimary),
          },
        ]}
      >
        <View
          style={[
            styles.presenceCore,
            {
              backgroundColor: theme.colors.accentPrimary,
            },
          ]}
        >
          <ReedText style={styles.presenceLetter} variant="section">
            R
          </ReedText>
        </View>
      </View>

      {/* Header chrome — fades in after mount so it doesn't flash in the same
          frame as the step swap, keeping the R avatar as the stable anchor. */}
      <Animated.View style={[styles.header, { opacity: chromeProgress, paddingTop: insets.top + theme.spacing.md }]}>
        <Pressable
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backLink, getTapScaleStyle(pressed)]}
        >
          <ReedText tone="muted" variant="bodyStrong">
            Back
          </ReedText>
        </Pressable>
        <ReedText variant="brand">REED</ReedText>
      </Animated.View>

      {/* Chat thread — positioned below the avatar using a known constant. */}
      <View
        style={[
          styles.thread,
          {
            paddingTop: threadTop - (insets.top + theme.spacing.md + 54),
          },
        ]}
      >
        {messages.slice(0, visibleCount).map(message => (
          <IntroBubble
            emphasis={message.emphasis}
            id={message.id}
            key={message.id}
            text={message.text}
          />
        ))}
        {visibleCount < messages.length ? <TypingBubble /> : null}
      </View>

      {showCta ? (
        <Animated.View style={{ opacity: ctaProgress, transform: [{ translateY: ctaY }] }}>
          <ReedButton label="Build my profile" onPress={onContinue} />
        </Animated.View>
      ) : (
        <View style={styles.ctaReserve} />
      )}
    </View>
  );
}

// Tailed chat bubble container — wraps any bubble content with the left-side
// tail that makes it read as a message from Reed, not a card.
function TailedBubbleShell({
  children,
  fill,
  border,
}: {
  children: React.ReactNode;
  fill: string;
  border: string;
}) {
  return (
    <View style={[styles.bubbleBody, { backgroundColor: fill, borderColor: border }]}>
      {children}
    </View>
  );
}

function IntroBubble({ emphasis = false, id, text }: { emphasis?: boolean; id: string; text: string }) {
  const { theme } = useReedTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    createTiming(progress, 1, reedMotion.durations.mode + 220).start();
  }, [progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <Animated.View
      style={[
        styles.chatBubbleAnimation,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, emphasis ? 1 : 0.92],
          }),
          transform: [{ translateY }],
        },
      ]}
    >
      <TailedBubbleShell
        fill={String(theme.colors.controlFill)}
        border={String(theme.colors.controlBorder)}
      >
        <ReedText
          style={[
            styles.bubbleText,
            { color: theme.colors.textPrimary },
          ]}
          variant="bodyStrong"
        >
          {text}
        </ReedText>
      </TailedBubbleShell>
    </Animated.View>
  );
}

function TypingBubble() {
  const { theme } = useReedTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    createTiming(progress, 1, reedMotion.durations.mode + 80).start();
  }, [progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  return (
    <Animated.View
      style={[
        styles.chatBubbleAnimation,
        {
          opacity: progress,
          transform: [{ translateY }],
        },
      ]}
    >
      <TailedBubbleShell
        fill={String(theme.colors.controlFill)}
        border={String(theme.colors.controlBorder)}
      >
        <View style={styles.typingDots}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={[
                styles.typingDot,
                { backgroundColor: String(theme.colors.textMuted) },
              ]}
            />
          ))}
        </View>
      </TailedBubbleShell>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  backLink: {
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 72,
  },
  presence: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: reedRadii.pill,
    elevation: 18,
    height: FIRST_EXPERIENCE_REED_MARK_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    width: FIRST_EXPERIENCE_REED_MARK_SIZE,
    zIndex: 10,
  },
  presenceCore: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: FIRST_EXPERIENCE_REED_MARK_SIZE,
    justifyContent: 'center',
    width: FIRST_EXPERIENCE_REED_MARK_SIZE,
  },
  presenceLetter: {
    color: '#f8fafc',
    fontSize: 24,
    lineHeight: 28,
  },
  thread: {
    alignSelf: 'center',
    flex: 1,
    gap: 8,
    maxWidth: 430,
    width: '100%',
  },
  chatBubbleAnimation: {
    alignSelf: 'flex-start',
    // Cap at 84% of the thread so long messages wrap rather than overflow.
    maxWidth: '84%',
  },
  bubbleBody: {
    // Squared bottom-left corner signals an incoming message without a tail.
    borderBottomLeftRadius: 4,
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    flexShrink: 1,
  },
  typingDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  typingDot: {
    borderRadius: reedRadii.pill,
    height: 7,
    opacity: 0.55,
    width: 7,
  },
  ctaReserve: {
    minHeight: 54,
  },
});
