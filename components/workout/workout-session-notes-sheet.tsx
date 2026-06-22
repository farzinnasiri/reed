import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { blurActiveElementOnWeb } from '@/components/ui/focus';
import { getGlassPaneTokens, getGlassScrimTokens } from '@/components/ui/glass-material';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedEasing, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { useSpeechDraft } from '@/lib/speech/use-speech-draft';

const MAX_SESSION_NOTES_LENGTH = 2000;

type SessionNotesSheetProps = {
  initialNotes: string;
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (notes: string) => Promise<void> | void;
};

export function WorkoutSessionNotesSheet({
  initialNotes,
  isOpen,
  isSaving = false,
  onClose,
  onSave,
}: SessionNotesSheetProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const scrim = getGlassScrimTokens(theme);
  const pane = useMemo(() => getGlassPaneTokens(theme), [theme]);
  const inputRef = useRef<TextInput | null>(null);
  const sheetProgress = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const [isMounted, setIsMounted] = useState(isOpen);
  const [draft, setDraft] = useState(initialNotes);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const appendTranscribedNote = useCallback((transcript: string) => {
    setDraft(currentDraft => {
      const prefix = currentDraft.trim().length > 0 ? `${currentDraft.trimEnd()}\n` : '';
      const room = MAX_SESSION_NOTES_LENGTH - prefix.length;
      if (room <= 0) {
        setLimitMessage('Limit reached.');
        return currentDraft;
      }

      const nextText = transcript.slice(0, room);
      setLimitMessage(nextText.length < transcript.length ? 'Transcript trimmed to the 2000 character limit.' : null);
      return `${prefix}${nextText}`;
    });
  }, []);
  const {
    retry: retryVoice,
    reset: resetVoice,
    start: startVoice,
    state: speechState,
    stop: stopVoice,
  } = useSpeechDraft('session_notes', appendTranscribedNote);

  useEffect(() => {
    if (isOpen) {
      blurActiveElementOnWeb();
      setIsMounted(true);
      setDraft(initialNotes);
      setLimitMessage(null);
      void resetVoice();
      requestAnimationFrame(() => {
        createTiming(sheetProgress, 1, reedMotion.durations.mode, reedEasing.easeOut).start();
        inputRef.current?.focus();
      });
      return;
    }

    createTiming(sheetProgress, 0, reedMotion.durations.mode, reedEasing.easeInOut).start(({ finished }) => {
      if (finished) setIsMounted(false);
    });
  }, [initialNotes, isOpen, sheetProgress]);

  const trimmedInitial = initialNotes.trim();
  const trimmedDraft = draft.trim();
  const remaining = MAX_SESSION_NOTES_LENGTH - draft.length;
  const isAtLimit = remaining === 0;
  const isNearLimit = remaining <= 120;
  const hasChanges = trimmedDraft !== trimmedInitial;
  const canSave = hasChanges && !isSaving;

  const counterColor = useMemo(() => {
    if (isAtLimit) return theme.colors.dangerText;
    if (isNearLimit) return theme.colors.accentPrimary;
    return theme.colors.textMuted;
  }, [isAtLimit, isNearLimit, theme.colors.accentPrimary, theme.colors.dangerText, theme.colors.textMuted]);

  function handleChangeText(nextValue: string) {
    setDraft(nextValue.slice(0, MAX_SESSION_NOTES_LENGTH));
    setLimitMessage(nextValue.length >= MAX_SESSION_NOTES_LENGTH ? 'Limit reached.' : null);
  }

  function handleVoicePress() {
    if (speechState.status === 'failed') {
      void retryVoice();
      return;
    }

    if (speechState.status === 'listening') {
      void stopVoice();
      return;
    }

    if (speechState.status === 'idle') {
      setLimitMessage(null);
      void startVoice();
    }
  }

  async function handleSave() {
    if (!canSave) return;
    await onSave(trimmedDraft);
  }

  if (!isMounted) {
    return null;
  }

  const overlayOpacity = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const panelTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [height * 0.55, 0],
  });

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={isMounted}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={sheetStyles.overlay}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: scrim.backgroundColor, opacity: overlayOpacity, pointerEvents: 'none' },
          ]}
        />
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[
            sheetStyles.sheetFrame,
            {
              marginBottom: Math.max(insets.bottom, 14),
              transform: [{ translateY: panelTranslateY }],
            },
          ]}
        >
          <GlassSurface
            contentStyle={sheetStyles.sheetContent}
            style={[sheetStyles.sheet, { backgroundColor: pane.backgroundColor, borderColor: pane.borderColor }]}
          >
            <View style={sheetStyles.handleArea}>
              <View style={[sheetStyles.handle, { backgroundColor: theme.colors.handleFill }]} />
            </View>
            <View style={sheetStyles.header}>
              <Pressable
                accessibilityLabel="Close session notes"
                onPress={onClose}
                style={({ pressed }) => [sheetStyles.iconButton, getTapScaleStyle(pressed)]}
              >
                <Ionicons color={String(theme.colors.textMuted)} name="close" size={19} />
              </Pressable>

              <View style={sheetStyles.headerCopy}>
                <ReedText variant="bodyStrong">Session notes</ReedText>
              </View>

              <View style={sheetStyles.headerActions}>
                <Pressable
                  accessibilityLabel={speechState.status === 'failed' ? 'Retry note dictation' : speechState.status === 'listening' ? 'Stop note dictation' : 'Start note dictation'}
                  disabled={isAtLimit || speechState.status === 'transcribing'}
                  onPress={handleVoicePress}
                  style={({ pressed }) => [
                    sheetStyles.iconButton,
                    speechState.status === 'listening' ? sheetStyles.activeVoiceButton : null,
                    {
                      borderColor: speechState.status === 'listening' ? theme.colors.accentPrimary : 'transparent',
                      borderWidth: speechState.status === 'listening' ? 1 : 0,
                      opacity: isAtLimit ? 0.45 : 1,
                      ...getTapScaleStyle(pressed, isAtLimit || speechState.status === 'transcribing'),
                    },
                  ]}
                >
                  <View style={sheetStyles.voiceButtonContent}>
                    <Ionicons
                      color={String(speechState.status === 'failed' ? theme.colors.dangerText : speechState.status === 'listening' ? theme.colors.accentPrimary : theme.colors.textPrimary)}
                      name={speechState.status === 'failed' ? 'refresh' : speechState.status === 'listening' ? 'stop' : speechState.status === 'transcribing' ? 'hourglass-outline' : 'mic-outline'}
                      size={19}
                    />
                    {speechState.status === 'listening' ? (
                      <VoiceButtonMeter level={speechState.voiceLevel} />
                    ) : null}
                  </View>
                </Pressable>

                <Pressable
                  accessibilityLabel="Save session notes"
                  disabled={!canSave}
                  onPress={handleSave}
                  style={({ pressed }) => [
                    sheetStyles.saveButton,
                    {
                      backgroundColor: canSave ? theme.colors.accentPrimary : theme.colors.controlFill,
                      ...getTapScaleStyle(pressed, !canSave),
                    },
                  ]}
                >
                  <Ionicons
                    color={String(canSave ? theme.colors.accentPrimaryText : theme.colors.textMuted)}
                    name={isSaving ? 'hourglass-outline' : 'checkmark'}
                    size={20}
                  />
                </Pressable>
              </View>
            </View>

            <View style={[sheetStyles.inputShell, { borderColor: theme.colors.inputBorder }]}>
              <TextInput
                ref={inputRef}
                maxLength={MAX_SESSION_NOTES_LENGTH}
                multiline
                onChangeText={handleChangeText}
                placeholder="Write what mattered in this session."
                placeholderTextColor={String(theme.colors.textMuted)}
                selectionColor={String(theme.colors.accentPrimary)}
                style={[
                  sheetStyles.input,
                  {
                    color: theme.colors.textPrimary,
                    fontFamily: theme.typography.body.fontFamily,
                  },
                ]}
                textAlignVertical="top"
                value={draft}
              />
              <View style={sheetStyles.counterPill}>
                <ReedText style={{ color: counterColor }} variant="caption">
                  {draft.length}/{MAX_SESSION_NOTES_LENGTH}
                </ReedText>
              </View>
            </View>
            {limitMessage ? (
              <ReedText style={sheetStyles.limitMessage} tone="muted" variant="caption">
                {limitMessage}
              </ReedText>
            ) : null}
            {speechState.error ? (
              <ReedText style={sheetStyles.limitMessage} tone="danger" variant="caption">
                {speechState.error}
              </ReedText>
            ) : null}
          </GlassSurface>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function VoiceButtonMeter({ level }: { level: number }) {
  const { theme } = useReedTheme();
  const bars = [0.45, 0.8, 0.6].map(weight => 5 + Math.round(level * weight * 12));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={sheetStyles.voiceMeter}>
      {bars.map((height, index) => (
        <View
          key={`${index}-${height}`}
          style={[
            sheetStyles.voiceMeterBar,
            {
              backgroundColor: theme.colors.accentPrimary,
              height,
              opacity: level > 0.04 ? 0.42 + (level * 0.5) : 0.22,
            },
          ]}
        />
      ))}
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  counterPill: {
    bottom: 10,
    position: 'absolute',
    right: 12,
  },
  handle: {
    borderRadius: reedRadii.pill,
    height: 4,
    width: 44,
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  activeVoiceButton: {
    paddingHorizontal: 10,
    width: 62,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 0,
    padding: 0,
    paddingBottom: 28,
  },
  inputShell: {
    borderRadius: reedRadii.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 178,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  voiceButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  voiceMeter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 18,
  },
  voiceMeterBar: {
    borderRadius: reedRadii.pill,
    width: 2,
  },
  limitMessage: {
    minHeight: 18,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    height: 44,
    justifyContent: 'center',
    width: 54,
  },
  sheet: {
    borderRadius: reedRadii.xl,
  },
  sheetContent: {
    gap: 12,
    padding: 16,
  },
  sheetFrame: {
    width: '100%',
  },
});
