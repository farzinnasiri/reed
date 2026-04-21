import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { GlassTabPill } from '@/components/ui/glass-tab-pill';
import {
  TAB_DOCK_BASE_BOTTOM_OFFSET,
  TAB_DOCK_HORIZONTAL_MARGIN,
  TAB_PILL_MIN_HEIGHT,
} from '@/components/ui/glass-material';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { SettingsSurface } from './settings-surface';
import { WorkoutSurface } from './workout-surface';
import { HomeSurface } from './home-surface';
import type { AppMode } from './types';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

const SHOULD_USE_NATIVE_DRIVER = Platform.OS !== 'web';
const MODE_INDEX: Record<AppMode, number> = {
  chat: 2,
  home: 0,
  settings: 3,
  workout: 1,
};

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
};

export function SignedInShell({
  appMode,
  displayName,
  onChangeMode,
}: SignedInShellProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  // Query used only to decide dock visibility; WorkoutSurface has its own
  // subscription and is the canonical owner of session state.
  const currentWorkoutSession = useQuery(api.liveSessions.getCurrent, {});
  const hasActiveWorkoutSession = currentWorkoutSession !== null && currentWorkoutSession !== undefined;

  // Preserve state for visited surfaces while still lazy-mounting settings/home
  // on first open to avoid unnecessary work on initial render.
  const tabTransition = useRef(new Animated.Value(MODE_INDEX[appMode])).current;
  const [visitedModes, setVisitedModes] = useState<Record<AppMode, boolean>>({
    chat: appMode === 'chat',
    home: appMode === 'home',
    settings: appMode === 'settings',
    workout: true,
  });
  const [dockHeight, setDockHeight] = useState(TAB_PILL_MIN_HEIGHT);

  useEffect(() => {
    setVisitedModes(current =>
      current[appMode]
        ? current
        : {
            ...current,
            [appMode]: true,
          },
    );

    Animated.timing(tabTransition, {
      duration: theme.motion.regular + 40,
      easing: Easing.out(Easing.cubic),
      toValue: MODE_INDEX[appMode],
      useNativeDriver: SHOULD_USE_NATIVE_DRIVER,
    }).start();
  }, [appMode, tabTransition, theme.motion.regular]);

  const homeLayerStyle = useMemo(() => getLayerStyle(tabTransition, MODE_INDEX.home), [tabTransition]);
  const workoutLayerStyle = useMemo(() => getLayerStyle(tabTransition, MODE_INDEX.workout), [tabTransition]);
  const chatLayerStyle = useMemo(() => getLayerStyle(tabTransition, MODE_INDEX.chat), [tabTransition]);
  const settingsLayerStyle = useMemo(() => getLayerStyle(tabTransition, MODE_INDEX.settings), [tabTransition]);

  const tabItems: Array<{
    accessibilityLabel: string;
    icon: ReactNode;
    id: AppMode;
    isActive: boolean;
  }> = [
    {
      accessibilityLabel: 'Home',
      icon: (
        <Ionicons
          color={String(appMode === 'home' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'home' ? 'home' : 'home-outline'}
          size={22}
        />
      ),
      id: 'home',
      isActive: appMode === 'home',
    },
    {
      accessibilityLabel: 'Workout',
      icon: (
        <Ionicons
          color={String(appMode === 'workout' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'workout' ? 'barbell' : 'barbell-outline'}
          size={22}
        />
      ),
      id: 'workout',
      isActive: appMode === 'workout',
    },
    {
      accessibilityLabel: 'Chat',
      icon: (
        <Ionicons
          color={String(appMode === 'chat' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'chat' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
          size={22}
        />
      ),
      id: 'chat',
      isActive: appMode === 'chat',
    },
    {
      accessibilityLabel: 'Settings',
      icon: (
        <Ionicons
          color={String(appMode === 'settings' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'settings' ? 'settings' : 'settings-outline'}
          size={22}
        />
      ),
      id: 'settings',
      isActive: appMode === 'settings',
    },
  ];

  // Hide the bottom dock during a live workout so the swipe cards have
  // full-screen room. The WorkoutSurface owns exit/back navigation in that
  // state via its own nav button.
  const showDock = !(appMode === 'workout' && hasActiveWorkoutSession);
  const isFullscreenWorkout = appMode === 'workout' && hasActiveWorkoutSession;
  const dockBottom = TAB_DOCK_BASE_BOTTOM_OFFSET + insets.bottom;
  const dockReservedSpace = showDock ? dockBottom + dockHeight : insets.bottom + theme.spacing.sm;

  return (
    <View
      style={[
        styles.shellRoot,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          paddingBottom: isFullscreenWorkout ? 0 : theme.spacing.lg,
        },
      ]}
    >
      <View style={styles.shellContentStack}>
        <View style={[styles.shellContentLayer, { pointerEvents: appMode === 'home' ? 'auto' : 'none' }]}>
          {visitedModes.home || appMode === 'home' ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                homeLayerStyle,
              ]}
            >
              <HomeSurface
                hasActiveSession={hasActiveWorkoutSession}
                onOpenWorkout={() => onChangeMode('workout')}
              />
            </Animated.View>
          ) : null}
        </View>

        <View style={[styles.shellContentLayer, { pointerEvents: appMode === 'workout' ? 'auto' : 'none' }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              workoutLayerStyle,
            ]}
          >
            <WorkoutSurface
              onExitWorkout={() => onChangeMode('chat')}
              showStartBackButton={false}
            />
          </Animated.View>
        </View>

        <View style={[styles.shellContentLayer, { pointerEvents: appMode === 'chat' ? 'auto' : 'none' }]}>
          {visitedModes.chat || appMode === 'chat' ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                chatLayerStyle,
              ]}
            >
              <CoachSurface displayName={displayName} dockReservedSpace={dockReservedSpace} />
            </Animated.View>
          ) : null}
        </View>

        <View style={[styles.shellContentLayer, { pointerEvents: appMode === 'settings' ? 'auto' : 'none' }]}>
          {appMode === 'settings' ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                settingsLayerStyle,
              ]}
            >
              <SettingsSurface />
            </Animated.View>
          ) : null}
        </View>
      </View>

      {showDock ? (
        <View
          onLayout={event => {
            const nextHeight = Math.round(event.nativeEvent.layout.height);
            if (nextHeight > 0 && nextHeight !== dockHeight) {
              setDockHeight(nextHeight);
            }
          }}
          style={[
            styles.bottomDockFloating,
            {
              bottom: dockBottom,
              left: TAB_DOCK_HORIZONTAL_MARGIN,
              right: TAB_DOCK_HORIZONTAL_MARGIN,
            },
          ]}
        >
          <GlassTabPill
            items={tabItems}
            onPress={onChangeMode}
          />
        </View>
      ) : null}
    </View>
  );
}

function CoachSurface({
  displayName,
  dockReservedSpace,
}: {
  displayName: string;
  dockReservedSpace: number;
}) {
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
        contentContainerStyle={[styles.chatScrollContent, { paddingBottom: dockReservedSpace + 108 }]}
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
            bottom: dockReservedSpace + 12,
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

function getLayerStyle(transition: Animated.Value, index: number) {
  return {
    opacity: transition.interpolate({
      extrapolate: 'clamp',
      inputRange: [index - 0.45, index, index + 0.45],
      outputRange: [0, 1, 0],
    }),
    transform: [
      {
        translateY: transition.interpolate({
          extrapolate: 'clamp',
          inputRange: [index - 0.45, index, index + 0.45],
          outputRange: [6, 0, -6],
        }),
      },
    ],
  };
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
  chatSurface: {
    flex: 1,
    minHeight: 0,
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    gap: 14,
    paddingTop: 10,
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
    position: 'absolute',
    zIndex: 25,
  },
});
