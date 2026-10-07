import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analytics } from '@/lib/analytics';
import { Keyboard, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, withDelay } from 'react-native-reanimated';
import { useReedReducedMotion as useReducedMotion } from '@/design/use-reed-reduced-motion';
import { scheduleOnRN } from 'react-native-worklets';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { KeyboardEvents, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as haptics from '@/design/haptics';
import { getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { StageRecedeProvider, useStageRecedeStyle } from '@/design/stage-recede';
import { withColorAlpha } from '@/design/system';
import { useAppShell } from '@/components/home/app-shell-context';
import { workoutRouteForIntent } from '@/components/home/app-routes';
import { Pulse } from '@/components/home/pulse/pulse';
import { PULSE_STRIP_HEIGHT } from '@/components/home/pulse/pulse-strip';
import { QuickLogSheet } from '@/components/home/quick-log-sheet';
import { YouSheet } from '@/components/home/you-sheet';
import { ReedText } from '@/components/ui/reed-text';
import { ComposerMenu } from './composer-menu';
import { WorkoutMenu } from './workout-menu';
import { ReedComposer, type ComposerMenuAnchor } from './reed-composer';
import { ReedDock } from './reed-dock';
import { ReedImageEditor } from './reed-image-editor';
import { PresenceMascot } from './presence-mascot';
import { PRESENCE_MASCOT_LEFT, PRESENCE_ROW_HEIGHT, PresenceRow } from './presence-row';
import { TodayView } from './today/today-view';
import { ThreadMask } from './thread/thread-mask';
import { ReedGlowField } from './presence/reed-glow-field';
import { mascotSizes, type MascotExpression } from './mascot';
import { greetingFaceStep } from './today/greeting';
import { useHomeMode } from './use-home-mode';
import { styles } from './reed.styles';
import { ReedThread, type ReedThreadScroll } from './reed-thread';
import { ReedWidgetActionsProvider, type ReedWidgetActions } from './widgets/registry';
import type { ReedSurfaceProps } from './reed.types';
import { useSharedComposerDraft } from './reed-composer-context';
import { useSharedReedConversation } from './reed-conversation-context';
import { getReedDraftLevel } from './presence/presence-state';
import { useReedPresence } from './presence/use-reed-presence';

const ANDROID_KEYBOARD_COMPOSER_CLEARANCE = 12;
// The Pulse has lg breathing room below the real safe area; chat dissolves beneath it over 46px.
const TOP_CHROME_FADE_HEIGHT = 46;
const COLUMN_MAX_WIDTH = 720;

export function ReedSurface(props: ReedSurfaceProps) {
  return (
    <StageRecedeProvider>
      <ReedHome {...props} />
    </StageRecedeProvider>
  );
}

function ReedHome({ displayName, onPulseOpened, onYouOpened, openPulse, openYou }: ReedSurfaceProps) {
  const { theme } = useReedTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { activeWorkout } = useAppShell();
  const stageStyle = useStageRecedeStyle();
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  // Set when a widget tile opened the sheet, so it starts on that preset.
  const [quickLogPresetKey, setQuickLogPresetKey] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<ComposerMenuAnchor | null>(null);
  const [isYouOpen, setIsYouOpen] = useState(false);
  const [isWorkoutMenuOpen, setIsWorkoutMenuOpen] = useState(false);
  const windowSize = useWindowDimensions();
  const [stageSize, setStageSize] = useState({ height: 0, width: 0 });
  const [isReadingHistory, setIsReadingHistory] = useState(false);
  const [heroSlot, setHeroSlot] = useState<{ centerY: number; size: number } | null>(null);
  const [isTodayMounted, setIsTodayMounted] = useState(false);
  // 0 while the middle is today mode, 1 once it is the thread; it fades the layers in and out.
  const chatProgress = useSharedValue(0);
  const todayExit = useSharedValue(0);
  const todayScrollY = useSharedValue(0);
  const scrollRef = useRef<ReedThreadScroll | null>(null);
  const sharedDraft = useSharedComposerDraft();
  const composerInputRef = useRef<TextInput>(null);
  const composerDraftSeed = sharedDraft.seed;
  const [composerDockHeight, setComposerDockHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboard = useReanimatedKeyboardAnimation();
  const [isThreadReady, setIsThreadReady] = useState(false);
  const draftLevel = getReedDraftLevel(composerDraftSeed.text);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [voiceToastMessage, setVoiceToastMessage] = useState<string | null>(null);
  const {
    attachFromCamera,
    attachFromFiles,
    attachFromLibrary,
    attachments,
    cancelImageEditor,
    canAttachMore,
    clearAttachments,
    editingImage,
    isPreparingAttachments,
    lastError: lastAttachmentError,
    readyAttachmentIds,
    removeAttachment,
    uploadEditedImage,
  } = sharedDraft.attachments;

  const quickActions = useQuery(api.reed.listQuickActions, {});
  const {
    hasMoreMessages,
    presence: conversationPresence,
    hasSendError,
    isOffline,
    retryUserMessage,
    isLoadingInitialMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
    messages,
    pendingRunId,
    retryAssistantMessage,
    sendPrompt,
  } = useSharedReedConversation();
  const { reset: resetVoice, retry: retryVoice, start: startVoice, state: speechState, stop: stopVoice } = sharedDraft.voice;
  const [previousVoiceError, setPreviousVoiceError] = useState(speechState.error);
  if (previousVoiceError !== speechState.error) {
    setPreviousVoiceError(speechState.error);
    if (speechState.error) setVoiceToastMessage(speechState.error);
  }
  const voiceState = useMemo(() => ({
    error: speechState.error,
    status: speechState.status,
    transcript: speechState.status === 'transcribing'
      ? 'Transcribing...'
      : speechState.status === 'failed'
        ? speechState.error ?? 'Could not transcribe audio.'
        : '',
    voiceLevel: speechState.voiceLevel,
  }), [speechState.error, speechState.status, speechState.voiceLevel]);

  const topChromeHeight = insets.top + theme.spacing.lg + PULSE_STRIP_HEIGHT + theme.spacing.xs;
  const contentTopPadding = topChromeHeight + TOP_CHROME_FADE_HEIGHT;
  // Pending replies are represented by the mascot at the end of the thread, not by their own rows.
  const threadMessages = useMemo(
    () => messages.filter(message => !(message.role === 'assistant' && message.status === 'pending')),
    [messages],
  );
  const { enterChat, enterToday, mode, note: todayNote } = useHomeMode({
    isLoadingMessages: isLoadingInitialMessages,
    messages: threadMessages,
  });
  const presence = useReedPresence({
    attachmentCount: attachments.length,
    draftLevel,
    hasActiveSession: activeWorkout !== null,
    hasAttachmentError: Boolean(lastAttachmentError) || hasSendError,
    isComposerFocused,
    isPreparingAttachments,
    isReady: isThreadReady,
    isReplyPending: Boolean(pendingRunId),
    replyRecovery: messages.findLast(message => message.role === 'assistant' && message.status === 'pending')?.replyRecovery,
    messages: threadMessages,
    voiceStatus: voiceState.status,
  });
  const touchPresence = presence.touch;
  const lookAt = presence.mascot.lookAt;
  const playMascot = presence.mascot.play;
  const showGreetingFace = useCallback((expression: MascotExpression) => playMascot([greetingFaceStep(expression)]), [playMascot]);
  const handlePulseChanged = useCallback((open: boolean) => {
    if (open) touchPresence();
    lookAt(open ? 'pulse' : 'center');
  }, [lookAt, touchPresence]);
  const todayKeyboardLift = Platform.OS === 'android' && keyboardHeight > 0
    ? Math.max(0, keyboardHeight - insets.bottom) + ANDROID_KEYBOARD_COMPOSER_CLEARANCE
    : 0;
  const keyboardLift = useDerivedValue(() => {
    if (Platform.OS === 'web') return 0;
    const height = -keyboard.height.get();
    return height > 0 ? Math.max(0, height - insets.bottom) + (Platform.OS === 'android' ? ANDROID_KEYBOARD_COMPOSER_CLEARANCE : 0) : 0;
  });
  const composerBottomPadding = insets.bottom + theme.spacing.xs;
  const dockClearance = composerDockHeight > 0
    ? composerDockHeight
    : composerBottomPadding + theme.spacing.xxl;
  // History scrolls behind the presence row. Padding keeps the latest reply above the fade.
  const presenceClearance = PRESENCE_ROW_HEIGHT + theme.spacing.md;
  useEffect(() => {
    const showSubscriptions = [
      KeyboardEvents.addListener('keyboardDidShow', event => {
        setKeyboardHeight(event.height);
      }),
    ];
    const hideSubscriptions = [
      KeyboardEvents.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      }),
    ];

    return () => {
      showSubscriptions.forEach(subscription => subscription.remove());
      hideSubscriptions.forEach(subscription => subscription.remove());
    };
  }, []);

  const handleThreadReady = useCallback(() => {
    if (!isLoadingInitialMessages && composerDockHeight > 0) setIsThreadReady(true);
  }, [composerDockHeight, isLoadingInitialMessages]);

  useEffect(() => {
    if (!voiceToastMessage) return;

    const timeout = setTimeout(() => setVoiceToastMessage(null), 3400);
    return () => clearTimeout(timeout);
  }, [voiceToastMessage]);

  // Keep the existing thread mounted and positioned before revealing it. History navigation
  // uses the same crossfade and mascot glide as sending, and returns through the reverse fade.
  const hasPlacedModeRef = useRef(false);
  useEffect(() => {
    if (mode === null) return;

    if (!hasPlacedModeRef.current) {
      hasPlacedModeRef.current = true;
      chatProgress.value = mode === 'chat' ? 1 : 0;
      todayExit.value = mode === 'chat' ? 1 : 0;
      return;
    }

    if (mode === 'chat') {
      if (!isThreadReady) return;
      todayExit.value = withTiming(1, { duration: reduceMotion ? reedMotion.reply.reducedMs : reedMotion.today.exitMs, reduceMotion: ReduceMotion.Never });
      chatProgress.value = withDelay(reduceMotion ? 0 : reedMotion.today.threadDelayMs, withTiming(1, { duration: reduceMotion ? reedMotion.reply.reducedMs : reedMotion.today.threadMs, reduceMotion: ReduceMotion.Never }, finished => {
        if (finished) scheduleOnRN(setIsTodayMounted, false);
      }));
    } else {
      chatProgress.value = withTiming(0, { duration: reduceMotion ? reedMotion.reply.reducedMs : reedMotion.today.threadMs, reduceMotion: ReduceMotion.Never });
      todayExit.value = withTiming(0, { duration: reduceMotion ? reedMotion.reply.reducedMs : reedMotion.today.exitMs, reduceMotion: ReduceMotion.Never });
    }
  }, [chatProgress, isThreadReady, mode, reduceMotion, todayExit]);

  const [previousMode, setPreviousMode] = useState(mode);
  if (previousMode !== mode) { setPreviousMode(mode); if (mode === 'today') setIsTodayMounted(true); }

  // Act once per request: on web the param can outlive `onYouOpened`.
  const hasHandledYouRequestRef = useRef(false);
  useEffect(() => {
    if (!openYou) {
      hasHandledYouRequestRef.current = false;
      return;
    }
    if (hasHandledYouRequestRef.current) return;
    hasHandledYouRequestRef.current = true;
    onYouOpened();
    setIsYouOpen(true);
  }, [onYouOpened, openYou]);

  function clearComposerState() {
    sharedDraft.replace('', 'typed');
    clearAttachments();
    resetVoice();
  }

  function handleComposerDraftChange(text: string) {
    sharedDraft.replace(text, sharedDraft.getSnapshot().source);
    presence.onDraftChanged(text);
  }

  function handleComposerFocusChange(isFocused: boolean) {
    setIsComposerFocused(isFocused);
  }

  function sendTyped(text: string) {
    if (sharedDraft.getSnapshot().source === 'voice') return sendVoiceDraft(text);
    const sentId = sendPrompt(text, 'typed', readyAttachmentIds);
    if (sentId) {
      presence.receive();
      analytics.reedMessageSent({
        source: 'typed',
        hasAttachments: readyAttachmentIds.length > 0,
      });
      haptics.light();
      clearComposerState();
      enterChat();
      return true;
    }

    return false;
  }

  function sendVoiceDraft(text: string) {
    const sentId = sendPrompt(text, 'voice', readyAttachmentIds);
    if (sentId) {
      presence.receive();
      analytics.reedMessageSent({
        source: 'voice',
        hasAttachments: readyAttachmentIds.length > 0,
      });
      haptics.light();
      clearComposerState();
      enterChat();
      return true;
    }

    return false;
  }

  function sendSuggestion(prompt: string) {
    const sentId = sendPrompt(prompt, 'quick-action', readyAttachmentIds);
    if (sentId) {
      presence.receive();
      analytics.reedMessageSent({
        source: 'quick-action',
        hasAttachments: readyAttachmentIds.length > 0,
      });
      haptics.light();
      clearComposerState();
      enterChat();
    }
  }

  function openSession() {
    router.navigate(workoutRouteForIntent({ kind: activeWorkout ? 'resume' : 'start' }));
  }

  function openMenu(anchor: ComposerMenuAnchor) {
    setMenuAnchor(anchor);
    if (!isMenuOpen) haptics.selection();
    setIsMenuOpen(current => !current);
  }

  const openLinkedSession = useCallback((sessionId: string) => {
    router.navigate(workoutRouteForIntent({ kind: 'session', sessionId }));
  }, []);

  const openWorkout = useCallback(() => {
    router.navigate(workoutRouteForIntent({ kind: 'resume' }));
  }, []);

  const openQuickLog = useCallback((presetKey: string | null) => {
    setQuickLogPresetKey(presetKey);
    setIsQuickLogOpen(true);
  }, []);
  const widgetActions = useMemo<ReedWidgetActions>(
    () => ({ openQuickLog, openSession: openLinkedSession, openWorkout }),
    [openLinkedSession, openQuickLog, openWorkout],
  );

  const threadStyle = useAnimatedStyle(() => ({ opacity: chatProgress.value }));
  const threadViewportStyle = useAnimatedStyle(() => ({ marginBottom: dockClearance + keyboardLift.get() }));
  const presenceRowStyle = useAnimatedStyle(() => ({ bottom: dockClearance + keyboardLift.get() }));
  const todayStyle = useAnimatedStyle(() => ({ opacity: 1 - todayExit.get(), transform: [{ translateY: reduceMotion ? 0 : todayExit.get() * reedMotion.today.exitY }] }));
  function handleStageLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;
    setStageSize(current => (current.height === height && current.width === width ? current : { height, width }));
  }

  // The mascot's two anchors, in stage coordinates. The corner is fixed by the presence row (above
  // the dock, so it rides the keyboard); the hero is wherever the today view put its slot.
  const stageWidth = stageSize.width || windowSize.width;
  const stageHeight = stageSize.height || windowSize.height;
  const columnLeft = Math.max(0, (stageWidth - COLUMN_MAX_WIDTH) / 2);
  const presenceBottom = dockClearance;
  const cornerAnchor = {
    cx: columnLeft + PRESENCE_MASCOT_LEFT + mascotSizes.corner / 2,
    cy: stageHeight - presenceBottom - PRESENCE_ROW_HEIGHT / 2,
    size: mascotSizes.corner,
  };
  const heroAnchor = heroSlot ? { cx: stageWidth / 2, cy: heroSlot.centerY, size: heroSlot.size } : null;
  const latestMessage = threadMessages.at(-1);
  const replyChips = latestMessage?.role === 'assistant' && latestMessage.status === 'sent'
    ? latestMessage.replies ?? []
    : [];
  const suggestions = replyChips.slice(0, 3).map(reply => ({ id: reply, label: reply, prompt: reply }));
  const isTodayMode = mode === 'today';

  return (
    <ReedWidgetActionsProvider value={widgetActions}>
      <View style={styles.root} onTouchStart={presence.touch}>
        <Animated.View onLayout={handleStageLayout} style={[styles.stage, stageStyle]}>
          <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }]}>
            <ReedGlowField sleeping={presence.sleeping} semanticState={presence.state} scrollY={todayScrollY} state={presence.sharedState} wordAt={presence.wordAt} receivedAt={presence.receivedAt} width={stageWidth} height={stageHeight} heroY={isTodayMode ? heroAnchor?.cy ?? stageHeight * 0.35 : null} />
          </View>

          <Animated.View
            accessibilityElementsHidden={isTodayMode}
            importantForAccessibility={isTodayMode ? 'no-hide-descendants' : 'auto'}
            style={[styles.threadViewport, threadStyle, threadViewportStyle, { pointerEvents: isTodayMode ? 'none' : 'auto' }]}
          >
            <ThreadMask top={topChromeHeight} fade={TOP_CHROME_FADE_HEIGHT}><ReedThread
              layout={{ bottom: presenceClearance, top: contentTopPadding }}
              history={{ hasMore: hasMoreMessages, loading: isLoadingOlderMessages, load: loadOlderMessages, timeZone: conversationPresence?.timeZone ?? 'UTC' }}
              interaction={{ ready: isThreadReady, onReady: handleThreadReady, reading: setIsReadingHistory, openSession: openLinkedSession, retryAssistant: retryAssistantMessage, retryUser: retryUserMessage, offline: isOffline }}
              messages={threadMessages}
              scrollRef={scrollRef}
            /></ThreadMask>
          </Animated.View>

          {isTodayMode || isTodayMounted ? (
            <Animated.View style={[StyleSheet.absoluteFill, styles.todayLayer, todayStyle, { pointerEvents: isTodayMode ? 'auto' : 'none' }]}>
              <TodayView
                layout={{ bottomInset: dockClearance + todayKeyboardLift + theme.spacing.sm, topInset: topChromeHeight + theme.spacing.xs, scrollY: todayScrollY, onHeroLayout: (centerY, size) => setHeroSlot(current => (current?.centerY === centerY && current.size === size ? current : { centerY, size })) }}
                disabled={Boolean(pendingRunId)}
                displayName={displayName}
                note={todayNote}
                onGreetingFace={showGreetingFace}
                onAsk={sendSuggestion}
                quickActions={quickActions ?? []}
                history={{ available: threadMessages.length > 0, open: () => { presence.touch(); enterChat(); } }}
                activity={{ activeSession: activeWorkout !== null, hasTrainingHistory: threadMessages.some(message => !!message.relatedSession), timeZone: conversationPresence?.timeZone }}
              />
            </Animated.View>
          ) : null}

          {!isTodayMode && mode ? <Animated.View style={[threadStyle, { position: 'absolute', top: topChromeHeight, left: theme.spacing.gutter, zIndex: 2 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to Today" onPress={() => { haptics.selection(); presence.touch(); enterToday(); }} style={({ pressed }) => [{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }, getTapScaleStyle(pressed)]}>
              <Ionicons name="chevron-back" size={16} color={String(theme.colors.inkSecondary)} /><ReedText variant="caption" tone="secondary">Today</ReedText>
            </Pressable>
          </Animated.View> : null}

          <Animated.View style={[styles.threadBottomFade, threadStyle, presenceRowStyle]}>
            <LinearGradient
              colors={[withColorAlpha(String(theme.colors.canvas), 0), theme.colors.canvas, theme.colors.canvas]}
              locations={[0, 0.6, 1]}
              style={{ height: presenceClearance }}
            />
          </Animated.View>

          <Animated.View style={[styles.presenceRow, threadStyle, presenceRowStyle]}>
            {isTodayMode ? null : (
              <PresenceRow
                suggestions={suggestions}
                disabled={Boolean(pendingRunId)}
                onReply={sendSuggestion}
                hint={presence.hint}
                aside={draftLevel !== 'none' || voiceState.status !== 'idle' || Boolean(pendingRunId) || presence.state === 'speaking'}
                reading={isReadingHistory}
                onLatest={() => { haptics.selection(); setIsReadingHistory(false); scrollRef.current?.scrollToEnd({ animated: !reduceMotion }); }}
              />
            )}
          </Animated.View>

          {mode ? (
            <PresenceMascot
              corner={cornerAnchor}
              state={presence.state}
              onTalk={() => { presence.touch(); composerInputRef.current?.focus(); }}
              hero={heroAnchor}
              keyboardLift={keyboardLift}
              mascot={presence.mascot}
              placement={isTodayMode ? 'hero' : 'corner'}
              scrollY={todayScrollY}
            />
          ) : null}

          <ReedDock
            keyboardLift={keyboardLift}
            bottomPadding={composerBottomPadding}
            hasOpenSession={activeWorkout !== null}
            focused={isComposerFocused}
            onHeightChange={nextHeight => {
              if (nextHeight > 0 && nextHeight !== composerDockHeight) {
                setComposerDockHeight(nextHeight);
              }
            }}
            onOpenSession={() => {
              Keyboard.dismiss();
              haptics.selection();
              setIsWorkoutMenuOpen(true);
            }}
          >
            <ReedComposer
              attachments={{ items: attachments, preparing: isPreparingAttachments, error: lastAttachmentError, remove: removeAttachment }}
              draft={{ seed: composerDraftSeed, change: handleComposerDraftChange, send: sendTyped }}
              inputRef={composerInputRef}
              interaction={{ focused: isComposerFocused, menuOpen: isMenuOpen, focus: handleComposerFocusChange, openMenu }}
              waiting={Boolean(pendingRunId)}
              voice={{ state: voiceState, retry: () => void retryVoice(), start: () => void startVoice(), stop: () => void stopVoice() }}
            />
          </ReedDock>
        </Animated.View>

        <Pulse onOpenChanged={handlePulseChanged} onOpenRequestHandled={onPulseOpened} onOpenYou={() => setIsYouOpen(true)} openRequested={openPulse} />

        {voiceToastMessage ? (
          <VoiceToast
            message={voiceToastMessage}
            onDismiss={() => setVoiceToastMessage(null)}
            top={topChromeHeight + theme.spacing.xs}
          />
        ) : null}

        <ReedImageEditor
          image={editingImage}
          onCancel={cancelImageEditor}
          onUseImage={uploadEditedImage}
          visible={Boolean(editingImage) && presence.active}
        />

        <ComposerMenu
          anchor={menuAnchor}
          attachmentsDisabled={Boolean(pendingRunId) || voiceState.status !== 'idle' || !canAttachMore}
          onClose={() => setIsMenuOpen(false)}
          onPickCamera={() => void attachFromCamera()}
          onPickFiles={() => void attachFromFiles()}
          onPickLibrary={() => void attachFromLibrary()}
          onQuickLog={() => openQuickLog(null)}
          visible={isMenuOpen}
        />
        <WorkoutMenu
          hasOpenSession={activeWorkout !== null}
          onClose={() => setIsWorkoutMenuOpen(false)}
          onOpenSession={openSession}
          onOpenSessions={() => router.navigate(workoutRouteForIntent({ kind: 'sessions' }))}
          onQuickLog={() => openQuickLog(null)}
          visible={isWorkoutMenuOpen}
        />
        <QuickLogSheet onClose={() => setIsQuickLogOpen(false)} presetKey={quickLogPresetKey} visible={isQuickLogOpen} />
        <YouSheet onClose={() => setIsYouOpen(false)} visible={isYouOpen} />
      </View>
    </ReedWidgetActionsProvider>
  );
}

function VoiceToast({
  message,
  onDismiss,
  top,
}: {
  message: string;
  onDismiss: () => void;
  top: number;
}) {
  const { theme } = useReedTheme();

  return (
    <View
      style={[
        styles.voiceToastContainer,
        {
          paddingHorizontal: theme.spacing.sm,
          pointerEvents: 'box-none',
          top,
        },
      ]}
    >
      <View
        accessibilityRole="alert"
        onTouchEnd={onDismiss}
        style={[
          styles.voiceToast,
          {
            backgroundColor: theme.colors.dangerFill,
            borderColor: theme.colors.dangerBorder,
          },
        ]}
      >
        <ReedText tone="danger" variant="caption">{message}</ReedText>
      </View>
    </View>
  );
}
