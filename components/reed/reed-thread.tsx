import { sessionDurationSeconds } from '@/domains/workout/session-duration';
import { MessageActions } from './message-actions';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as haptics from '@/design/haptics';
import { SCREEN_CONTENT_HORIZONTAL_MARGIN, reedThreadMetrics } from '@/design/system';
import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { FlatList, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useReedReducedMotion as useReducedMotion } from '@/design/use-reed-reduced-motion';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle, reedMotion } from '@/design/motion';
import { useEntryAnimation } from '@/design/use-entry-animation';
import { useReedTheme } from '@/design/provider';
import { formatMessageDate, isSameMessageDay } from './reed.presenter';
import { styles } from './reed.styles';
import type { ReedMessage, ReedRelatedSession } from './reed.types';
import { ReplyText, WidgetEnter } from './thread/reply-reveal';
import { usePresenceActivity } from './presence/use-presence-activity';

export type ReedThreadScroll = Pick<FlatList<ReedMessage>, 'scrollToEnd' | 'scrollToOffset'>;
type ReedThreadList = ReedThreadScroll & Partial<Pick<FlatList<ReedMessage>, 'getScrollableNode'>>;

function ReedThreadComponent({ layout, history, interaction, messages, scrollRef }: {
  layout: { bottom: number; top: number; sheet?: boolean };
  history: { hasMore: boolean; loading: boolean; load: () => void; timeZone: string };
  interaction: {
    ready: boolean; onReady: () => void; reading: (reading: boolean) => void;
    openSession: (sessionId: string) => void;
    retryAssistant: (message: ReedMessage) => void; retryUser: (message: ReedMessage) => void; offline: boolean;
  };
  messages: ReedMessage[];
  scrollRef: RefObject<ReedThreadScroll | null>;
}) {
  const { bottom: contentPaddingBottom, top: contentPaddingTop } = layout;
  const List = layout.sheet ? BottomSheetFlatList<ReedMessage> : Animated.FlatList<ReedMessage>;
  const { hasMore: hasMoreMessages, loading: isLoadingOlder, load: onLoadOlderMessages } = history;
  const { ready: isReady, onReady, reading: onReadingHistoryChange, openSession: onOpenSession, retryAssistant: onRetryAssistantMessage, retryUser: onRetryUserMessage, offline: isOffline } = interaction;
  const active = usePresenceActivity();
  const reduceMotion = useReducedMotion();
  // Messages already on screen when the thread settles (and any that have entered since) never
  // animate again, so history and recycled rows stay still.
  const [initialNewestMessageAt, setInitialNewestMessageAt] = useState<number | null>(null);
  const settledMessageIdsRef = useRef(new Set<string>());
  if (isReady && initialNewestMessageAt === null) {
    setInitialNewestMessageAt(Math.max(0, ...messages.map(message => message.createdAt)));
  }
  useEffect(() => {
    if (initialNewestMessageAt === null) return;
    for (const message of messages) {
      if (message.createdAt <= initialNewestMessageAt) settledMessageIdsRef.current.add(message.id);
    }
  }, [initialNewestMessageAt, messages]);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTargetRef = useRef<number | null>(null);
  const listRef = useRef<ReedThreadList | null>(null);
  const attachList = useCallback((node: ReedThreadList | null) => { listRef.current = node; }, []);
  const hasPositionedRef = useRef(false);
  const readingHistoryRef = useRef(false);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const olderAnchorRef = useRef<{ id: string; y: number } | null>(null);
  const shouldFollowLatestRef = useRef(true);
  const olderRequestRef = useRef(false);
  useEffect(() => { olderRequestRef.current = isLoadingOlder; }, [isLoadingOlder, messages.length]);

  // RN Web ignores maintainVisibleContentPosition. Keep the existing first row at its measured
  // position while a page and its live widgets finish loading; native uses the list's own anchor.
  function preserveOlderAnchor() {
    if (Platform.OS !== 'web' || !olderAnchorRef.current) return;
    const anchor = olderAnchorRef.current;
    const row = document.getElementById(`reed-message-${anchor.id}`);
    if (!row) return;
    const shift = row.getBoundingClientRect().y - anchor.y;
    if (Math.abs(shift) < 0.5) return;
    scrollOffsetRef.current = Math.max(0, scrollOffsetRef.current + shift);
    isAutoScrollingRef.current = true;
    autoScrollTargetRef.current = scrollOffsetRef.current;
    listRef.current?.scrollToOffset({ offset: scrollOffsetRef.current, animated: false });
  }

  const followLatest = useCallback((animated: boolean) => {
    // Web ResizeObserver and animation-frame delivery can lag behind a React commit. Read the
    // actual scroll host while positioning instead of waiting for another frame to measure it.
    const host = Platform.OS === 'web' ? listRef.current?.getScrollableNode?.() as HTMLElement | undefined : undefined;
    const height = host?.scrollHeight ?? contentHeightRef.current;
    const viewport = host?.clientHeight ?? viewportHeightRef.current;
    const currentOffset = host?.scrollTop ?? scrollOffsetRef.current;
    if (!listRef.current || viewport <= 0 || height <= 0) return;
    contentHeightRef.current = height;
    viewportHeightRef.current = viewport;
    const offset = Math.max(0, height - viewport);
    const moving = Math.abs(offset - currentOffset) > 1;
    isAutoScrollingRef.current = moving;
    autoScrollTargetRef.current = moving ? offset : null;
    // Row entrances provide web motion. Essential positioning must also work when that
    // browser's frame clock is suspended; native keeps its platform smooth scroll.
    listRef.current.scrollToOffset({ animated: animated && !reduceMotion && Platform.OS !== 'web' && moving, offset });
    hasPositionedRef.current = true;
    onReady();
  }, [onReady, reduceMotion]);

  const interruptFollowing = useCallback(() => {
    autoScrollTargetRef.current = null;
    isAutoScrollingRef.current = false;
    shouldFollowLatestRef.current = false;
    olderAnchorRef.current = null;
  }, []);

  const returnToLatest = useCallback((animated: boolean) => {
    olderAnchorRef.current = null;
    shouldFollowLatestRef.current = true;
    readingHistoryRef.current = false;
    onReadingHistoryChange(false);
    followLatest(animated);
  }, [followLatest, onReadingHistoryChange]);

  useImperativeHandle(scrollRef, () => ({
    scrollToEnd: options => returnToLatest(options?.animated ?? true),
    scrollToOffset: options => listRef.current?.scrollToOffset(options),
  }), [returnToLatest]);

  const newestUserId = messages.findLast(message => message.role === 'user')?.id;
  const previousUserId = useRef(newestUserId);
  useLayoutEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = newestUserId;
    if (!previous || !newestUserId || newestUserId === previous) return;
    // Sending while reading history returns to the new turn, even before its height is measured.
    returnToLatest(false);
  }, [newestUserId, returnToLatest]);

  const latestRole = messages.at(-1)?.role;
  const handleLatestCommit = useCallback(() => {
    if (Platform.OS === 'web' && shouldFollowLatestRef.current) followLatest(latestRole === 'assistant');
  }, [followLatest, latestRole]);


  function requestEarlier() {
    if (olderRequestRef.current) return;
    olderRequestRef.current = true;
    shouldFollowLatestRef.current = false;
    if (Platform.OS === 'web' && messages[0]) {
      const row = document.getElementById(`reed-message-${messages[0].serverId ?? messages[0].id}`);
      if (row) olderAnchorRef.current = { id: messages[0].serverId ?? messages[0].id, y: row.getBoundingClientRect().y };
    }
    onLoadOlderMessages();
  }
  return (
    <View style={[styles.threadRoot, !isReady && styles.threadRootHidden]} {...(Platform.OS === 'web' ? {
      // RN Web does not emit native drag callbacks for wheel/keyboard scrolling.
      onWheel: interruptFollowing,
      onTouchMove: interruptFollowing,
      onKeyDown: (event: { key: string }) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) interruptFollowing();
      },
    } : {})}>
      <List
        contentContainerStyle={StyleSheet.flatten([
          styles.content,
          styles.thread,
          styles.column,
          {
            paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN,
            paddingTop: contentPaddingTop,
          },
        ])}
        data={messages}
        initialNumToRender={30}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        keyExtractor={message => message.id}
        // VirtualizedList's scrollToEnd includes measured footer space, but not container
        // paddingBottom. The jump button must leave the complete last reply above the fade.
        ListFooterComponent={<View style={{ height: contentPaddingBottom }} />}
        ListHeaderComponent={hasMoreMessages ? <View style={{ alignItems: 'center', padding: 12 }}><ReedText tone="muted" variant="caption">{isLoadingOlder ? 'Loading earlier messages' : 'Earlier messages'}</ReedText></View> : null}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        maxToRenderPerBatch={8}
        // Initial positioning and size changes never count as scrolling into history. Otherwise
        // the first layout can request older pages and anchor the list halfway through the thread.
        onContentSizeChange={(_width, contentHeight) => {
          contentHeightRef.current = contentHeight;
          preserveOlderAnchor();
          if (!hasPositionedRef.current || shouldFollowLatestRef.current) {
            followLatest(hasPositionedRef.current && isReady && messages.at(-1)?.role === 'assistant');
          }
        }}
        onLayout={event => {
          viewportHeightRef.current = event.nativeEvent.layout.height;
          if (!hasPositionedRef.current || shouldFollowLatestRef.current) followLatest(false);
        }}
        onScroll={event => {
          const offset = event.nativeEvent.contentOffset.y;
          const moved = Math.abs(offset - scrollOffsetRef.current) > 1;
          const towardEarlier = offset < scrollOffsetRef.current - 1;
          if (!isAutoScrollingRef.current && Math.abs(offset - scrollOffsetRef.current) > 1) olderAnchorRef.current = null;
          scrollOffsetRef.current = offset;
          if (isAutoScrollingRef.current) {
            if (autoScrollTargetRef.current !== null && Math.abs(offset - autoScrollTargetRef.current) <= 1) {
              autoScrollTargetRef.current = null;
              isAutoScrollingRef.current = false;
            }
            return;
          }
          if (!isReady || !hasPositionedRef.current || !moved) return;
          // Only an explicit drag/wheel/touch/key gesture opts out of following. Browser focus,
          // scroll anchoring and viewport changes can also produce onScroll before measurement.
          if (shouldFollowLatestRef.current) {
            followLatest(false);
            return;
          }
          const distanceFromBottom = Math.max(0, event.nativeEvent.contentSize.height
            - event.nativeEvent.layoutMeasurement.height
            - event.nativeEvent.contentOffset.y);
          shouldFollowLatestRef.current = distanceFromBottom < 80;
          if (towardEarlier && offset < reedThreadMetrics.historyPrefetch && hasMoreMessages && !isLoadingOlder) requestEarlier();
          const reading = distanceFromBottom > 180;
          if (reading !== readingHistoryRef.current) {
            readingHistoryRef.current = reading;
            onReadingHistoryChange(reading);
          }
        }}
        onScrollBeginDrag={interruptFollowing}
        scrollEventThrottle={16}
        ref={attachList}
        renderItem={({ item: message, index }) => {
          const previousMessage = messages[index - 1];
          const shouldShowDateIndicator = !previousMessage || !isSameMessageDay(previousMessage.createdAt, message.createdAt, history.timeZone);
          const settledIds = settledMessageIdsRef.current;
          return (
            <MessageCluster anchorId={message.serverId ?? message.id} id={message.id} settledIds={settledIds} onCommit={index === messages.length - 1 ? handleLatestCommit : undefined}>
              {shouldShowDateIndicator ? <MemoDateIndicator createdAt={message.createdAt} timeZone={history.timeZone} /> : null}
              <MemoMessageRow fresh={Boolean(active && isReady && initialNewestMessageAt !== null && message.createdAt > initialNewestMessageAt && !readingHistoryRef.current && !settledIds.has(message.id))} message={message} onOpenSession={onOpenSession} onRetryAssistantMessage={onRetryAssistantMessage} onRetryUserMessage={onRetryUserMessage} isOffline={isOffline} />
            </MessageCluster>
          );
        }}
        showsVerticalScrollIndicator={false}
        windowSize={9}
      />
    </View>
  );
}

export const ReedThread = memo(ReedThreadComponent);

// Keep recycled and initially loaded rows settled; new messages own their own entrance.
function MessageCluster({
  anchorId,
  children,
  id,
  settledIds,
  onCommit,
}: {
  children: ReactNode;
  id: string;
  settledIds: Set<string> | null;
  anchorId: string;
  onCommit?: () => void;
}) {
  useLayoutEffect(() => { onCommit?.(); }, [children, onCommit]);
  // Once a row has entered, a recycled remount of it must not animate again.
  useEffect(() => {
    settledIds?.add(id);
  }, [id, settledIds]);
  return <View nativeID={`reed-message-${anchorId}`} style={styles.messageCluster}>{children}</View>;
}

function MessageRow({ fresh, message, onOpenSession, onRetryAssistantMessage, onRetryUserMessage, isOffline }: {
  fresh: boolean;
  message: ReedMessage;
  onOpenSession: (sessionId: string) => void;
  onRetryAssistantMessage: (message: ReedMessage) => void;
  onRetryUserMessage: (message: ReedMessage) => void;
  isOffline: boolean;
}) {
  if (message.role === 'user') {
    return <UserMessage fresh={fresh} message={message} offline={isOffline} onRetry={() => onRetryUserMessage(message)} />;
  }

  return (
    <AssistantMessage
      fresh={fresh}
      message={message}
      onOpenSession={onOpenSession}
      onRetry={() => {
        onRetryAssistantMessage(message);
        haptics.selection();
      }}
    />
  );
}

function UserMessage({ fresh, message, offline, onRetry }: { fresh: boolean; message: ReedMessage; offline: boolean; onRetry: () => void }) {
  const { theme } = useReedTheme();
  const entry = useEntryAnimation({ enabled: fresh, delay: reedMotion.messageEntry.userDelayMs, duration: reedMotion.messageEntry.durationMs, translateY: reedMotion.messageEntry.userY, translateX: reedMotion.messageEntry.userX, fromScale: reedMotion.messageEntry.userScale });
  return (
    <Animated.View style={[styles.messageRowRight, entry]}>
      <View style={styles.userMessageGroup}>
        <Pressable accessibilityRole={message.status === 'failed' ? 'button' : undefined} accessibilityLabel={message.status === 'failed' ? 'Retry unsent message' : undefined} disabled={message.status !== 'failed'} onPress={() => { haptics.selection(); onRetry(); }}>
          <View style={[styles.messageBubble, { backgroundColor: theme.colors.surfaceRaised, opacity: message.status === 'failed' ? 0.6 : 1 }]}>
            <MessageAttachments attachments={message.attachments} />
            {message.text.trim().length > 0 ? <ReedText variant="body">{message.text}</ReedText> : null}
          </View>
        </Pressable>
        {message.reaction ? <View style={{ alignSelf: 'flex-end', paddingHorizontal: theme.spacing.xs, paddingVertical: theme.spacing.xxs, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceRaised }}><ReedText accessibilityLabel={`Reed reacted ${message.reaction}`} variant="caption">{message.reaction}</ReedText></View> : null}
        {message.status === 'failed' ? <ReedText tone="muted" variant="caption">Not sent · <ReedText tone="accent" variant="caption">Retry</ReedText></ReedText> : message.status === 'pending' && offline ? <ReedText tone="muted" variant="caption">Waiting for connection</ReedText> : null}
      </View>
    </Animated.View>
  );
}

// Reed's replies are plain `voice` text at full width: no avatar, name or bubble. The presence
// corner is Reed.
function AssistantMessage({
  fresh,
  message,
  onOpenSession,
  onRetry,
}: {
  fresh: boolean;
  message: ReedMessage;
  onOpenSession: (sessionId: string) => void;
  onRetry: () => void;
}) {
  const { theme } = useReedTheme();
  const entry = useEntryAnimation({ enabled: fresh, duration: reedMotion.messageEntry.durationMs, translateY: reedMotion.messageEntry.replyY });
  const messageText = message.text ?? '';
  if (message.status === 'failed') {
    return (
      <View style={styles.messageRowLeft}>
        <View style={[styles.failedReply, { backgroundColor: theme.colors.dangerFill, borderColor: theme.colors.dangerBorder }]}>
          <ReedText tone="danger" variant="body">{messageText || 'Reed could not answer that.'}</ReedText>
          {message.serverId ? (
            <Pressable
              accessibilityHint="Retries this Reed response without sending a new message."
              accessibilityLabel="Retry Reed response"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onRetry}
              style={({ pressed }) => [styles.coachNoteCaption, getTapScaleStyle(pressed)]}
            >
              <Ionicons color={String(theme.colors.dangerInk)} name="refresh-outline" size={15} />
              <ReedText tone="danger" variant="bodyStrong">Retry</ReedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const showActionBar = messageText.trim().length > 0 && !message.isAgentThinkingMessage;
  const content = (
    <>
      {message.isCoachNote ? (
        <View style={styles.coachNoteCaption}>
          <View style={[styles.coachNoteMark, { backgroundColor: theme.colors.accent }]} />
          <ReedText tone="muted" variant="caption">
            {message.relatedSession ? 'After your session' : 'Check-in'}
          </ReedText>
        </View>
      ) : null}

      <MessageAttachments attachments={message.attachments} />

      {messageText.trim().length > 0 ? <ReplyText text={messageText} /> : null}

      {message.widget ? <WidgetEnter fresh={fresh} message={message} /> : null}

      {message.relatedSession && message.widget?.kind !== 'session_summary' ? (
        <RelatedSessionRow onOpen={() => onOpenSession(message.relatedSession!.sessionId)} session={message.relatedSession} />
      ) : null}
    </>
  );

  return <Animated.View style={[styles.messageRowLeft, styles.assistantMessage, entry]}>
    {showActionBar ? <MessageActions text={messageText} messageId={message.status === 'sent' ? message.serverId : undefined} reaction={message.reaction}>{content}</MessageActions> : content}
  </Animated.View>;
}

// A session in the conversation is a past row: a 46px pill that opens the session.
function RelatedSessionRow({ onOpen, session }: { onOpen: () => void; session: ReedRelatedSession }) {
  const { theme } = useReedTheme();
  const durationMinutes = Math.max(1, Math.round(sessionDurationSeconds(session, session.endedAt) / 60));
  const detail = `${durationMinutes} min · ${session.exerciseCount} ${session.exerciseCount === 1 ? 'exercise' : 'exercises'}`;

  return (
    <Pressable
      accessibilityHint="Opens this session in Sessions."
      accessibilityLabel={`Session from ${formatMessageDate(session.startedAt)}, ${detail}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.pastRow, { backgroundColor: theme.colors.surface }, getTapScaleStyle(pressed)]}
    >
      <View style={[styles.pastRowIcon, { backgroundColor: theme.colors.surfaceRaised }]}>
        <Ionicons color={String(theme.colors.inkMuted)} name="barbell-outline" size={16} />
      </View>
      <ReedText numberOfLines={1} style={styles.pastRowLabel} tone="secondary">Session · {formatMessageDate(session.startedAt)}</ReedText>
      <ReedText numberOfLines={1} tone="muted" variant="caption">{detail}</ReedText>
      <Ionicons color={String(theme.colors.inkMuted)} name="chevron-forward" size={15} />
    </Pressable>
  );
}

function MessageAttachments({ attachments }: { attachments: ReedMessage['attachments'] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <View style={styles.messageAttachmentGrid}>
      {attachments.map(attachment => (
        <Image
          accessibilityIgnoresInvertColors
          key={attachment.id}
          resizeMode="cover"
          source={{ uri: attachment.url }}
          style={styles.messageAttachmentImage}
        />
      ))}
    </View>
  );
}

function DateIndicator({ createdAt, timeZone }: { createdAt: number; timeZone: string }) {
  return (
    <View style={styles.dateIndicatorRow}>
      <ReedText tone="muted" variant="caption">
        {formatMessageDate(createdAt, timeZone)}
      </ReedText>
    </View>
  );
}

const MemoDateIndicator = memo(DateIndicator);
const MemoMessageRow = memo(MessageRow);
