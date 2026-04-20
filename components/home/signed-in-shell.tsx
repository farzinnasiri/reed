import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useReedTheme } from '@/design/provider';
import { WorkoutSurface } from './workout-surface';
import type { AppMode } from './types';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

const SHOULD_USE_NATIVE_DRIVER = Platform.OS !== 'web';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'intro-1',
    role: 'assistant',
    text: "I'm Reed. When the backend is wired, this is where coaching, check-ins, and voice will live.",
  },
  {
    id: 'intro-2',
    role: 'assistant',
    text: 'For now the interface is local, but the conversation surface is real.',
  },
];

type SignedInShellProps = {
  appMode: AppMode;
  displayName: string;
  onChangeMode: (mode: AppMode) => void;
  onOpenSettings: () => void;
};

export function SignedInShell({
  appMode,
  displayName,
  onChangeMode,
  onOpenSettings,
}: SignedInShellProps) {
  const { theme } = useReedTheme();
  // Query used only to decide dock visibility; WorkoutSurface has its own
  // subscription and is the canonical owner of session state.
  const currentWorkoutSession = useQuery(api.liveSessions.getCurrent, {});
  const hasActiveWorkoutSession = currentWorkoutSession !== null && currentWorkoutSession !== undefined;

  // Animate the crossfade between tabs. Both surfaces remain mounted so
  // WorkoutSurface internal state (editing sets, rest timer, page) is
  // preserved while the user briefly checks the Coach tab.
  const tabTransition = useRef(new Animated.Value(appMode === 'workout' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(tabTransition, {
      duration: theme.motion.regular + 40,
      easing: Easing.out(Easing.cubic),
      toValue: appMode === 'workout' ? 1 : 0,
      useNativeDriver: SHOULD_USE_NATIVE_DRIVER,
    }).start();
  }, [appMode, tabTransition, theme.motion.regular]);

  const coachOpacity = tabTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const coachTranslateY = tabTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  const workoutOpacity = tabTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const workoutTranslateY = tabTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  const appOptions = [
    {
      accessibilityLabel: 'Workout',
      icon: (
        <Ionicons
          color={String(appMode === 'workout' ? theme.colors.pillActiveText : theme.colors.textMuted)}
          name="barbell-outline"
          size={20}
        />
      ),
      value: 'workout' as const,
    },
    {
      accessibilityLabel: 'Coach',
      icon: (
        <Ionicons
          color={String(appMode === 'coach' ? theme.colors.pillActiveText : theme.colors.textMuted)}
          name="chatbubble-ellipses-outline"
          size={20}
        />
      ),
      value: 'coach' as const,
    },
  ];

  // Hide the bottom dock during a live workout so the swipe cards have
  // full-screen room. The WorkoutSurface owns exit/back navigation in that
  // state via its own nav button.
  const showDock = !(appMode === 'workout' && hasActiveWorkoutSession);

  return (
    <View
      style={[
        styles.shellRoot,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.lg,
        },
      ]}
    >
      {/* Settings button — only visible on the Coach tab */}
      {appMode === 'coach' ? (
        <View style={styles.shellHeaderFloating}>
          <ReedIconButton accessibilityLabel="Open settings" onPress={onOpenSettings}>
            <Ionicons color={String(theme.colors.textPrimary)} name="settings-outline" size={19} />
          </ReedIconButton>
        </View>
      ) : null}

      <View style={styles.shellContentStack}>
        {/*
          Both surfaces stay mounted so internal state (chat draft, workout
          metrics, rest timer) is not lost when switching tabs.
          We switch hit-testing with pointerEvents and visibility with opacity
          instead of display:'none' (which would stop layout but not effects).
        */}
        <View style={[styles.shellContentLayer, { pointerEvents: appMode === 'coach' ? 'auto' : 'none' }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity: coachOpacity,
                transform: [{ translateY: coachTranslateY }],
              },
            ]}
          >
            <CoachSurface displayName={displayName} />
          </Animated.View>
        </View>

        <View style={[styles.shellContentLayer, { pointerEvents: appMode === 'workout' ? 'auto' : 'none' }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity: workoutOpacity,
                transform: [{ translateY: workoutTranslateY }],
              },
            ]}
          >
            <WorkoutSurface
              onExitWorkout={() => onChangeMode('coach')}
              showStartBackButton={false}
            />
          </Animated.View>
        </View>
      </View>

      {showDock ? (
        <View style={styles.bottomDockFloating}>
          <SegmentedControl<AppMode>
            compact
            iconOnly
            onChange={onChangeMode}
            options={appOptions}
            value={appMode}
          />
        </View>
      ) : null}
    </View>
  );
}

function CoachSurface({ displayName }: { displayName: string }) {
  const { theme } = useReedTheme();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isListening) {
      voicePulse.stopAnimation();
      voicePulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(voicePulse, {
          duration: theme.motion.slow * 2,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: SHOULD_USE_NATIVE_DRIVER,
        }),
        Animated.timing(voicePulse, {
          duration: theme.motion.slow * 2,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: SHOULD_USE_NATIVE_DRIVER,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
      voicePulse.setValue(0);
    };
  }, [isListening, theme.motion.slow, voicePulse]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const voiceScale = voicePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });

  const voiceOpacity = voicePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.34],
  });

  function handleSend() {
    const text = draft.trim();

    if (!text) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setMessages(current => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text,
      },
    ]);
    setDraft('');
    setIsTyping(true);

    typingTimeoutRef.current = setTimeout(() => {
      setMessages(current => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: buildCoachReply(text, displayName),
        },
      ]);
      setIsTyping(false);
      typingTimeoutRef.current = null;
    }, 900);
  }

  return (
    <View style={styles.chatSurface}>
      <ScrollView
        contentContainerStyle={styles.chatScrollContent}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.chatScroll}
      >
        {messages.map(message => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {isTyping ? <TypingIndicator /> : null}
      </ScrollView>

      <View
        style={[
          styles.composerShell,
          {
            backgroundColor: theme.colors.controlFill,
            borderColor: theme.colors.controlBorder,
          },
        ]}
      >
        <View style={styles.composerRow}>
          <TextInput
            autoCorrect={false}
            multiline
            onChangeText={setDraft}
            placeholder="Message Reed"
            placeholderTextColor={String(theme.colors.textMuted)}
            spellCheck={false}
            style={[
              styles.composerInput,
              {
                color: theme.colors.textPrimary,
                fontFamily: theme.typography.body.fontFamily,
                includeFontPadding: false,
              },
            ]}
            textAlignVertical="center"
            value={draft}
          />

          <View style={styles.composerActions}>
            <View style={styles.voiceWrap}>
              {isListening ? (
                <Animated.View
                  style={[
                    styles.voicePulse,
                    {
                      backgroundColor: theme.colors.accentPrimary,
                      opacity: voiceOpacity,
                      transform: [{ scale: voiceScale }],
                    },
                  ]}
                />
              ) : null}
              <Pressable
                accessibilityLabel={isListening ? 'Stop voice capture' : 'Start voice capture'}
                onPress={() => setIsListening(current => !current)}
                style={({ pressed }) => [
                  styles.composerActionButton,
                  {
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Ionicons
                  color={String(theme.colors.textPrimary)}
                  name={isListening ? 'stop' : 'mic-outline'}
                  size={18}
                />
              </Pressable>
            </View>

            <Pressable
              accessibilityLabel="Send message"
              disabled={!draft.trim()}
              onPress={handleSend}
              style={({ pressed }) => [
                styles.composerActionButton,
                {
                  opacity: !draft.trim() ? 0.45 : pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Ionicons color={String(theme.colors.textPrimary)} name="arrow-up" size={18} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme } = useReedTheme();
  const isAssistant = message.role === 'assistant';

  return (
    <View style={[styles.messageRow, isAssistant ? styles.messageLeft : styles.messageRight]}>
      {isAssistant ? (
        <View
          style={[
            styles.assistantAvatar,
            {
              backgroundColor: theme.colors.controlFill,
              borderColor: theme.colors.controlBorder,
            },
          ]}
        >
          <ReedText variant="bodyStrong">R</ReedText>
        </View>
      ) : null}

      <View
        style={[
          styles.bubble,
          isAssistant
            ? {
                backgroundColor: theme.colors.controlFill,
                borderColor: theme.colors.controlBorder,
              }
            : {
                backgroundColor: theme.colors.accentPrimary,
                borderColor: theme.colors.accentPrimary,
              },
        ]}
      >
        <ReedText
          style={{ color: isAssistant ? theme.colors.textPrimary : theme.colors.accentPrimaryText }}
        >
          {message.text}
        </ReedText>
      </View>
    </View>
  );
}

function TypingIndicator() {
  const { theme } = useReedTheme();
  const first = useRef(new Animated.Value(0.3)).current;
  const second = useRef(new Animated.Value(0.3)).current;
  const third = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createSequence = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: SHOULD_USE_NATIVE_DRIVER,
          }),
          Animated.timing(value, {
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            toValue: 0.3,
            useNativeDriver: SHOULD_USE_NATIVE_DRIVER,
          }),
        ]),
      );

    const a = createSequence(first, 0);
    const b = createSequence(second, 120);
    const c = createSequence(third, 240);

    a.start();
    b.start();
    c.start();

    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [first, second, third]);

  return (
    <View style={[styles.messageRow, styles.messageLeft]}>
      <View
        style={[
          styles.assistantAvatar,
          {
            backgroundColor: theme.colors.controlFill,
            borderColor: theme.colors.controlBorder,
          },
        ]}
      >
        <ReedText variant="bodyStrong">R</ReedText>
      </View>
      <View
        style={[
          styles.typingBubble,
          {
            backgroundColor: theme.colors.controlFill,
            borderColor: theme.colors.controlBorder,
          },
        ]}
      >
        {[first, second, third].map((value, index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              {
                backgroundColor: theme.colors.textMuted,
                opacity: value,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function buildCoachReply(message: string, displayName: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('leg') || normalized.includes('squat')) {
    return `Noted, ${displayName}. When the coach backend is wired, this is where I’d help structure your lower-body day and progression.`;
  }

  if (normalized.includes('tired') || normalized.includes('sleep')) {
    return 'That’s exactly the kind of context Reed should react to. Recovery, effort, and plan adjustments belong here.';
  }

  return `I’ve got that. For now this is a local mock reply, but this thread will become Reed’s real coaching conversation surface.`;
}

const styles = StyleSheet.create({
  shellRoot: {
    flex: 1,
  },
  shellContentStack: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  shellContentLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shellHeaderFloating: {
    position: 'absolute',
    right: 20,
    top: 28,
    zIndex: 30,
  },
  chatSurface: {
    flex: 1,
    minHeight: 0,
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    gap: 14,
    paddingBottom: 208,
    paddingTop: 78,
  },
  messageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    maxWidth: '100%',
  },
  messageLeft: {
    justifyContent: 'flex-start',
  },
  messageRight: {
    justifyContent: 'flex-end',
  },
  assistantAvatar: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  bubble: {
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typingBubble: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  typingDot: {
    borderRadius: 99,
    height: 7,
    width: 7,
  },
  composerShell: {
    borderRadius: 30,
    borderWidth: 1,
    bottom: 74,
    left: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  composerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  composerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  voiceWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  voicePulse: {
    borderRadius: 99,
    height: 30,
    position: 'absolute',
    width: 30,
    zIndex: -1,
  },
  composerInput: {
    alignSelf: 'center',
    flex: 1,
    fontSize: 15,
    height: 21,
    lineHeight: 21,
    maxHeight: 132,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  composerActionButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  bottomDockFloating: {
    bottom: 20,
    left: 20,
    position: 'absolute',
    right: 20,
    zIndex: 25,
  },
});
