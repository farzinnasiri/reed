import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { WorkoutSurface } from '@/components/workout/workout-surface';
import { SettingsSurface } from './settings-surface';
import { HomeSurface } from './home-surface';
import { getFirstName, pickHomeGreeting } from './home-greetings';
import type { AppMode } from './types';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
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
  const [dockHeight, setDockHeight] = useState(TAB_PILL_MIN_HEIGHT);
  const [isEditingSettingsProfile, setIsEditingSettingsProfile] = useState(false);
  const [currentDayKey, setCurrentDayKey] = useState(() => new Date().toDateString());
  const homeHeadline = useMemo(
    () => pickHomeGreeting(getFirstName(displayName)),
    [displayName, currentDayKey],
  );

  useEffect(() => {
    if (appMode !== 'settings' && isEditingSettingsProfile) {
      setIsEditingSettingsProfile(false);
    }
  }, [appMode, isEditingSettingsProfile]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextDayKey = new Date().toDateString();
      setCurrentDayKey(prev => (prev === nextDayKey ? prev : nextDayKey));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

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
  const showDock = !(appMode === 'workout' && hasActiveWorkoutSession) && !isEditingSettingsProfile;
  const isFullscreenWorkout = appMode === 'workout' && hasActiveWorkoutSession;
  const dockBottom = TAB_DOCK_BASE_BOTTOM_OFFSET + insets.bottom;
  const dockReservedSpace = showDock ? dockBottom + dockHeight : insets.bottom + theme.spacing.sm;

  function renderModeSurface(mode: AppMode) {
    switch (mode) {
      case 'home':
        return (
          <HomeSurface
            hasActiveSession={hasActiveWorkoutSession}
            homeHeadline={homeHeadline}
            onOpenWorkout={() => onChangeMode('workout')}
          />
        );
      case 'workout':
        return (
          <WorkoutSurface
            onExitWorkout={() => onChangeMode('chat')}
            showStartBackButton={false}
          />
        );
      case 'chat':
        return <CoachSurface displayName={displayName} dockReservedSpace={dockReservedSpace} />;
      case 'settings':
        return <SettingsSurface onEditingProfileChange={setIsEditingSettingsProfile} />;
      default:
        return null;
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        <View style={[styles.shellContentLayer, { pointerEvents: 'box-none' }]}>
          <View
            style={[
              styles.shellScreenCanvas,
              { backgroundColor: theme.colors.canvas },
            ]}
          >
            {renderModeSurface(appMode)}
          </View>
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
    </KeyboardAvoidingView>
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

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

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
              <Pressable
                accessibilityLabel={isListening ? 'Stop voice capture' : 'Start voice capture'}
                onPress={() => setIsListening(current => !current)}
                style={({ pressed }) => [
                  styles.composerActionButton,
                  getTapScaleStyle(pressed),
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
                getTapScaleStyle(pressed, !draft.trim()),
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
        {[0, 1, 2].map(index => (
          <View
            key={index}
            style={[
              styles.typingDot,
              {
                backgroundColor: theme.colors.textMuted,
                opacity: 0.6,
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
  shellScreenCanvas: {
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
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typingBubble: {
    borderRadius: reedRadii.md,
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
    borderRadius: reedRadii.xl,
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
