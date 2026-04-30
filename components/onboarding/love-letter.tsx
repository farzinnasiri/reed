import { useEffect, useMemo, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';

type LoveLetterProps = {
  displayName: string;
  onContinue: () => void;
};

const LETTER_LINES = [
  "I'm Reed — your trainer. Your coach.",
  'I carry everything — every method, every coach, every lesson learned the hard way.',
  'All of it, pointed at one goal: you.',
  "I won't always be easy. But I'll always be honest.",
  "I won't always tell you what you want to hear. But I'll always tell you what you need.",
  '',
  'I might get strict with you.',
  'YOU need it.',
  'It might take time to really know each other.',
  "Don't sweat it.",
  "But I'm here for you",
  'every day, every hour, every minute.',
  "Don't forget it.",
  '',
  "We'll figure each other out. That's okay.",
  'Good things take a little time.',
  "What I can promise you right now: I'm not going anywhere.",
  'Every day. Every hour. Every minute.',
  "I'm in YOUR corner.",
  'Trust the process. Trust me.',
];

const STRONG_LINES = new Set(['YOU need it.', "I'm in YOUR corner.", 'Trust the process. Trust me.']);

const EMPHASIS_LINES = new Set([
  'you need it.',
  "don't forget it.",
  'trust the process. trust me.',
  'are you ready?',
]);

function getRevealDuration(line: string) {
  if (!line.trim()) {
    return reedMotion.durations.mode;
  }

  return reedMotion.durations.mode + 80;
}

function getPostRevealDelay(line: string) {
  if (!line.trim()) {
    return 280;
  }

  const words = line
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const readingDelay = Math.max(320, Math.min(1100, words * 180));
  const emphasisBonus = EMPHASIS_LINES.has(line.trim().toLowerCase()) ? 360 : 0;

  return readingDelay + emphasisBonus;
}

export function LoveLetter({ displayName, onContinue }: LoveLetterProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const name = displayName.trim() || 'there';
  const lines = useMemo(() => [`Hey ${name}.`, ...LETTER_LINES, '', 'Are YOU ready?'], [name]);
  const animatedValues = useRef(lines.map(() => new Animated.Value(0))).current;
  const signatureProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValues.forEach(value => value.setValue(0));
    signatureProgress.setValue(0);

    const sequenceSteps: Animated.CompositeAnimation[] = [Animated.delay(220)];

    lines.forEach((line, index) => {
      sequenceSteps.push(createTiming(animatedValues[index], 1, getRevealDuration(line)));
      sequenceSteps.push(Animated.delay(getPostRevealDelay(line)));
    });

    sequenceSteps.push(createTiming(signatureProgress, 1, reedMotion.durations.mode + 260));

    Animated.sequence(sequenceSteps).start();
  }, [animatedValues, lines, signatureProgress]);

  return (
    <View
      style={[
        styles.root,
        {
          paddingBottom: insets.bottom + theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <ReedText variant="brand">REED</ReedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.letterFrame}>
          <View style={styles.letterBlock}>
            {lines.map((line, index) => {
              const progress = animatedValues[index];
              return (
                <Animated.View
                  key={`${line}-${index}`}
                  style={{
                    opacity: progress.interpolate({
                      inputRange: [0, 0.35, 1],
                      outputRange: [0, 0.18, 1],
                    }),
                    transform: [
                      {
                        translateY: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                    ],
                  }}
                >
                  {line ? (
                    <ReedText
                      style={index === lines.length - 1 ? styles.readyLine : undefined}
                      variant={
                        index === 0 || index === lines.length - 1
                          ? 'section'
                          : STRONG_LINES.has(line)
                            ? 'bodyStrong'
                            : 'body'
                      }
                    >
                      {line}
                    </ReedText>
                  ) : (
                    <View style={styles.breakLine} />
                  )}
                </Animated.View>
              );
            })}
          </View>

          <Animated.View
            style={[
              styles.signatureBlock,
              {
                opacity: signatureProgress,
                transform: [
                  {
                    translateY: signatureProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.signatureRule, { backgroundColor: theme.colors.borderSoft }]} />
            <ReedText style={styles.signature} tone="accent">
              With ❤️ from Reed
            </ReedText>
            <ReedText tone="muted" variant="caption">
              and the people building him
            </ReedText>
          </Animated.View>
        </View>
      </ScrollView>

      <Animated.View style={styles.ctaBlock}>
        <Animated.View style={{ opacity: signatureProgress }}>
          <ReedButton label="I'm ready" onPress={onContinue} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    paddingBottom: 18,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 28,
    paddingTop: 8,
  },
  letterFrame: {
    alignSelf: 'center',
    maxWidth: 440,
    width: '84%',
  },
  letterBlock: {
    gap: 9,
  },
  breakLine: {
    height: 10,
  },
  readyLine: {
    paddingTop: 8,
  },
  signatureBlock: {
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 22,
  },
  signatureRule: {
    height: 1,
    marginBottom: 6,
    width: 72,
  },
  signature: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  ctaBlock: {
    paddingTop: 8,
  },
});
