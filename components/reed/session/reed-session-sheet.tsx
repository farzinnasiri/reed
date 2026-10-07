import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, TextInput, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReedSheet } from "@/components/ui/reed-sheet";
import { ReedIconButton } from "@/components/ui/reed-icon-button";
import { ReedText } from "@/components/ui/reed-text";
import { QuickLogSheet } from "@/components/home/quick-log-sheet";
import { workoutRouteForIntent } from "@/components/home/app-routes";
import { useReedTheme } from "@/design/provider";
import * as haptics from "@/design/haptics";
import { reedMotion } from "@/design/motion";
import type { ReedMessageContext } from "@/convex/reedSessionContext";
import { ReedComposer, type ComposerMenuAnchor } from "../reed-composer";
import { ReedThread, type ReedThreadScroll } from "../reed-thread";
import { PresenceRow } from "../presence-row";
import { reedSessionMetrics } from "@/design/system";
import { ComposerMenu } from "../composer-menu";
import { ReedImageEditor } from "../reed-image-editor";
import { useSharedComposerDraft } from "../reed-composer-context";
import { useSharedReedConversation } from "../reed-conversation-context";
import { getReedDraftLevel } from "../presence/presence-state";
import { useReedPresence } from "../presence/use-reed-presence";
import { PendingStatus } from "../presence/pending-status";
import { ReedWidgetActionsProvider } from "../widgets/registry";
import { useSessionMascotBridge } from "./session-mascot";
import {
  PresenceActivityProvider,
  usePresenceActivity,
} from "../presence/use-presence-activity";
import type { MascotController } from "../mascot";
import { analytics } from "@/lib/analytics";

export type SessionAskContext = {
  message: ReedMessageContext;
  label: string;
  whisper?: string;
};
const STARTERS = [
  {
    label: "Machine’s taken",
    prompt: "The machine is taken. Suggest a swap for this exercise.",
  },
  {
    label: "Form check",
    prompt: "What should I focus on for form on this exercise?",
  },
  { label: "What now?", prompt: "What should I do next in this session?" },
];
export function ReedSessionSheet({
  open,
  onClose,
  context,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  context: SessionAskContext | null;
  onApplied: (exerciseId: string) => void;
}) {
  const sheet = useRef<BottomSheetModal>(null);
  const active = usePresenceActivity();
  const { drive: driveMascot, sheetPosition } = useSessionMascotBridge();
  useEffect(() => {
    if (open) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [open]);
  return (
    <ReedSheet
      ref={sheet}
      conversation
      position={sheetPosition}
      onDismiss={() => {
        Keyboard.dismiss();
        onClose();
      }}
    >
      <PresenceActivityProvider active={active && open}>
        <SessionConversation
          open={open}
          context={context}
          close={() => {
            sheet.current?.dismiss();
          }}
          onApplied={onApplied}
          driveMascot={driveMascot}
        />
      </PresenceActivityProvider>
    </ReedSheet>
  );
}
function SessionConversation({
  open,
  context,
  close,
  onApplied,
  driveMascot,
}: {
  open: boolean;
  context: SessionAskContext | null;
  close: () => void;
  onApplied: (exerciseId: string) => void;
  driveMascot: (mascot: MascotController) => void;
}) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const conversation = useSharedReedConversation();
  const owner = useSharedComposerDraft();
  const input = useRef<TextInput>(null),
    root = useRef<View>(null),
    scroll = useRef<ReedThreadScroll>(null);
  const [focused, setFocused] = useState(false);
  const draftLevel = getReedDraftLevel(owner.seed.text);
  const [reading, setReading] = useState(false);
  const [menu, setMenu] = useState<ComposerMenuAnchor | null>(null);
  const [quickLog, setQuickLog] = useState<{ preset: string | null } | null>(
    null,
  );
  const [spentStarters, setSpentStarters] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousOpen !== open) {
    setPreviousOpen(open);
    if (!open) { setFocused(false); setMenu(null); }
  }
  useEffect(() => {
    if (!open && closeTimer.current) clearTimeout(closeTimer.current);
  }, [open]);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  const attachments = owner.attachments;
  const voice = owner.voice;
  const voiceState = {
    error: voice.state.error,
    status: voice.state.status,
    transcript:
      voice.state.status === "transcribing"
        ? "Transcribing..."
        : voice.state.status === "failed"
          ? (voice.state.error ?? "Could not transcribe audio.")
          : "",
    voiceLevel: voice.state.voiceLevel,
  };
  const messages = useMemo(
    () =>
      conversation.messages.filter(
        (row) => !(row.role === "assistant" && row.status === "pending"),
      ),
    [conversation.messages],
  );
  const presence = useReedPresence({
    attachmentCount: attachments.attachments.length,
    draftLevel,
    hasActiveSession: true,
    hasAttachmentError:
      Boolean(attachments.lastError) || conversation.hasSendError,
    isComposerFocused: focused || open,
    isPreparingAttachments: attachments.isPreparingAttachments,
    isReady: open && !conversation.isLoadingInitialMessages,
    isReplyPending: Boolean(conversation.pendingRunId),
    replyRecovery: conversation.messages.findLast(message => message.role === 'assistant' && message.status === 'pending')?.replyRecovery,
    messages,
    voiceStatus: voiceState.status,
  });
  useEffect(() => {
    if (open)
      driveMascot({
        ...presence.mascot,
        expression:
          presence.mascot.expression === "encouraging"
            ? "happy"
            : presence.state !== "thinking" && presence.mascot.expression === "focused"
              ? "watching"
              : presence.mascot.expression,
      });
  }, [driveMascot, open, presence.mascot, presence.state]);
  const latest = messages.at(-1);
  const repliedHere = messages.some(
    (row) =>
      row.role === "assistant" &&
      row.status === "sent" &&
      row.chapterId === conversation.presence?.currentChapterId,
  );
  const chips =
    latest?.role === "assistant" && latest.status === "sent"
      ? (latest.replies ?? []).map((label) => ({ label, prompt: label }))
      : !spentStarters && !repliedHere && !conversation.pendingRunId
        ? STARTERS
        : [];
  const aside =
    draftLevel !== "none" ||
    voiceState.status !== "idle" ||
    Boolean(conversation.pendingRunId) ||
    presence.state === "speaking" ||
    reading;
  function send(text: string, source: "typed" | "voice" | "quick-action") {
    const id = conversation.sendPrompt(
      text,
      source,
      attachments.readyAttachmentIds,
      context?.message,
    );
    if (!id) return false;
    analytics.reedMessageSent({
      source,
      hasAttachments: attachments.readyAttachmentIds.length > 0,
    });
    presence.receive();
    haptics.light();
    setSpentStarters(true);
    owner.replace("", "typed");
    attachments.clearAttachments();
    voice.reset();
    return true;
  }
  const widgetActions = useMemo(
    () => ({
      openQuickLog: (preset: string | null) => setQuickLog({ preset }),
      openWorkout: close,
      openSession: (sessionId: string) => {
        close();
        router.navigate(workoutRouteForIntent({ kind: "session", sessionId }));
      },
      onSessionChangeApplied: (_sessionId: string, exerciseId: string) => {
        presence.mascot.react("happy");
        onApplied(exerciseId);
        closeTimer.current = setTimeout(
          close,
          reedMotion.session.appliedHoldMs,
        );
      },
    }),
    [close, onApplied, presence.mascot],
  );
  return (
    <ReedWidgetActionsProvider value={widgetActions}>
      <View ref={root} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.chromeGutter,
            paddingBottom: theme.spacing.xs,
          }}
        >
          <View
            style={{
              width: reedSessionMetrics.sheetMascot,
              height: reedSessionMetrics.sheetMascot,
            }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReedText variant="headline">Reed</ReedText>
            {context ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: theme.colors.accentSoft,
                  borderRadius: theme.radii.sm,
                  paddingHorizontal: theme.spacing.xs,
                  paddingVertical: theme.spacing.xxs,
                }}
              >
                <ReedText
                  variant="micro"
                  numberOfLines={1}
                  style={{ color: theme.colors.accentInk }}
                >
                  {context.label}
                </ReedText>
              </View>
            ) : null}
          </View>
          {presence.hint ? (
            <View style={{ flex: 1, minWidth: 0 }}><PendingStatus text={presence.hint} /></View>
          ) : null}
          <ReedIconButton
            accessibilityLabel="Close Reed"
            onPress={close}
            shape="pill"
          >
            <ReedText tone="secondary">×</ReedText>
          </ReedIconButton>
        </View>
        {context?.whisper ? (
          <ReedText
            variant="caption"
            tone="secondary"
            style={{
              paddingHorizontal: theme.spacing.gutter,
              paddingBottom: theme.spacing.xs,
            }}
          >
            {context.whisper}
          </ReedText>
        ) : null}
        <ReedThread
          layout={{ sheet: true, bottom: theme.spacing.md, top: 0 }}
          history={{
            hasMore: conversation.hasMoreMessages,
            loading: conversation.isLoadingOlderMessages,
            load: conversation.loadOlderMessages,
            timeZone: conversation.presence?.timeZone ?? "UTC",
          }}
          interaction={{
            ready: !conversation.isLoadingInitialMessages,
            onReady: () => {},
            reading: setReading,
            openSession: widgetActions.openSession,
            retryAssistant: conversation.retryAssistantMessage,
            retryUser: conversation.retryUserMessage,
            offline: conversation.isOffline,
          }}
          messages={messages}
          scrollRef={scroll}
        />
        <View
          style={{
            paddingHorizontal: theme.spacing.chromeGutter,
            paddingTop: theme.spacing.xs,
            paddingBottom: insets.bottom + theme.spacing.xs,
          }}
        >
          <PresenceRow
            placement="sheet"
            suggestions={chips.map((chip) => ({ id: chip.label, ...chip }))}
            disabled={Boolean(conversation.pendingRunId)}
            onReply={(prompt) => send(prompt, "quick-action")}
            aside={aside}
            reading={reading}
            hint={null}
            onLatest={() => {
              setReading(false);
              scroll.current?.scrollToEnd({ animated: false });
            }}
          />
          <ReedComposer
            inputRef={input}
            attachments={{
              items: attachments.attachments,
              preparing: attachments.isPreparingAttachments,
              error: attachments.lastError,
              remove: attachments.removeAttachment,
            }}
            draft={{
              seed: owner.seed,
              change: (text) => {
                owner.replace(text, owner.getSnapshot().source);
                presence.onDraftChanged(text);
              },
              send: (text) => send(text, owner.getSnapshot().source),
            }}
            interaction={{
              sheet: true,
              focused,
              menuOpen: Boolean(menu),
              focus: setFocused,
              openMenu: (anchor) => {
                if (menu) {
                  setMenu(null);
                  return;
                }
                haptics.selection();
                root.current?.measureInWindow((x, y) =>
                  setMenu({ ...anchor, x: anchor.x - x, y: anchor.y - y }),
                );
              },
            }}
            waiting={Boolean(conversation.pendingRunId)}
            voice={{
              state: voiceState,
              start: () => void voice.start(),
              stop: () => void voice.stop(),
              retry: () => void voice.retry(),
            }}
          />
        </View>
        <ComposerMenu
          visible={Boolean(menu)}
          anchor={menu}
          onClose={() => setMenu(null)}
          attachmentsDisabled={
            Boolean(conversation.pendingRunId) ||
            voiceState.status !== "idle" ||
            !attachments.canAttachMore
          }
          onPickCamera={() => void attachments.attachFromCamera()}
          onPickLibrary={() => void attachments.attachFromLibrary()}
          onPickFiles={() => void attachments.attachFromFiles()}
          onQuickLog={() => setQuickLog({ preset: null })}
        />
        <ReedImageEditor
          visible={open && Boolean(attachments.editingImage)}
          image={attachments.editingImage}
          onCancel={attachments.cancelImageEditor}
          onUseImage={attachments.uploadEditedImage}
        />
        <QuickLogSheet
          visible={Boolean(quickLog)}
          presetKey={quickLog?.preset ?? null}
          onClose={() => setQuickLog(null)}
        />
      </View>
    </ReedWidgetActionsProvider>
  );
}
