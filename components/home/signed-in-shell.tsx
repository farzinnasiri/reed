import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { GlassTabPill } from '@/components/ui/glass-tab-pill';
import {
  REED_CHAT_USER,
  ReedChatTypingBubble,
  ReedGiftedChat,
  VIEWER_CHAT_USER,
  type ReedChatMessage,
} from '@/components/ui/reed-chat';
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
import { ProfileSurface } from './profile-surface';
import { HomeSurface } from './home-surface';
import { getFirstName, pickHomeGreeting } from './home-greetings';
import type { AppMode } from './types';

const INITIAL_MESSAGES: ReedChatMessage[] = [
  {
    _id: 'intro-1',
    createdAt: new Date(0),
    text: "I'm Reed. When the backend is wired, this is where coaching, check-ins, and voice will live.",
    user: REED_CHAT_USER,
  },
  {
    _id: 'intro-2',
    createdAt: new Date(1),
    text: 'For now the interface is local, but the conversation surface is real.',
    user: REED_CHAT_USER,
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
    if (appMode !== 'user' && isEditingSettingsProfile) {
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
      accessibilityLabel: 'Reed',
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
      accessibilityLabel: 'Profile',
      icon: (
        <Ionicons
          color={String(appMode === 'user' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'user' ? 'person' : 'person-outline'}
          size={22}
        />
      ),
      id: 'user',
      isActive: appMode === 'user',
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
      case 'user':
        return <ProfileSurface displayName={displayName} onEditingProfileChange={setIsEditingSettingsProfile} />;
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
  const [messages, setMessages] = useState<ReedChatMessage[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [replyTimeout, setReplyTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (replyTimeout) {
        clearTimeout(replyTimeout);
      }
    };
  }, [replyTimeout]);

  function handleSend(nextMessages: ReedChatMessage[]) {
    const sentMessage = nextMessages[0];
    const text = sentMessage?.text.trim();
    if (!sentMessage || !text) {
      return;
    }

    if (replyTimeout) {
      clearTimeout(replyTimeout);
    }

    const now = Date.now();
    setMessages(current => current.concat({
      ...sentMessage,
      _id: `user-${now}`,
      createdAt: new Date(now),
      user: VIEWER_CHAT_USER,
    }));
    setIsTyping(true);

    const timeout = setTimeout(() => {
      setMessages(current => current.concat({
        _id: `assistant-${Date.now()}`,
        createdAt: new Date(),
        text: buildCoachReply(text, displayName),
        user: REED_CHAT_USER,
      }));
      setIsTyping(false);
      setReplyTimeout(null);
    }, 900);
    setReplyTimeout(timeout);
  }

  return (
    <View style={styles.chatSurface}>
      <View
        style={[
          styles.giftedChatWrap,
          { paddingBottom: dockReservedSpace + 12 },
        ]}
      >
        <ReedGiftedChat
          isAlignedTop
          isInverted={false}
          isTyping={isTyping}
          keyboardShouldPersistTaps="handled"
          listProps={{
            contentContainerStyle: styles.giftedChatListContent,
            showsVerticalScrollIndicator: false,
          }}
          messages={messages}
          messagesContainerStyle={styles.giftedMessagesContainer}
          onSend={handleSend}
          renderActions={() => (
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
          )}
          renderTypingIndicator={() => (isTyping ? <ReedChatTypingBubble /> : null)}
          textInputProps={{
            autoCorrect: false,
            placeholder: 'Message Reed',
            spellCheck: false,
          }}
          user={VIEWER_CHAT_USER}
        />
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
  giftedChatWrap: {
    flex: 1,
    minHeight: 0,
  },
  giftedMessagesContainer: {
    backgroundColor: 'transparent',
  },
  giftedChatListContent: {
    gap: 14,
    paddingTop: 10,
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
    borderRadius: reedRadii.md,
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
    borderRadius: reedRadii.pill,
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
    borderRadius: reedRadii.pill,
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
