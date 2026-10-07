import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { bareInputStyle, blurActiveElementOnWeb } from '@/components/ui/focus';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedSheetTextInput } from '@/components/ui/reed-sheet-input';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { useSpeechDraft } from '@/lib/speech/use-speech-draft';

const MAX_SESSION_NOTES_LENGTH = 2000;
// The keyboard rises while the sheet is still arriving; focus once it has landed.
const FOCUS_DELAY_MS = 350;

type SessionNotesSheetProps = {
  initialNotes: string;
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (notes: string) => Promise<void> | void;
};

export function WorkoutSessionNotesSheet({ initialNotes, isOpen, isSaving = false, onClose, onSave }: SessionNotesSheetProps) {
  useEffect(() => {
    if (isOpen) blurActiveElementOnWeb();
  }, [isOpen]);

  return (
    <ReedSheet onDismiss={onClose} open={isOpen}>
      <NotesBody initialNotes={initialNotes} isSaving={isSaving} onClose={onClose} onSave={onSave} />
    </ReedSheet>
  );
}

// Mounted only while the sheet is open, so every opening starts from the saved notes.
function NotesBody({ initialNotes, isSaving, onClose, onSave }: Omit<SessionNotesSheetProps, 'isOpen'> & { isSaving: boolean }) {
  const { theme } = useReedTheme();
  const inputRef = useRef<TextInput>(null);
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
    void resetVoice();
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [resetVoice]);

  const trimmedInitial = initialNotes.trim();
  const trimmedDraft = draft.trim();
  const remaining = MAX_SESSION_NOTES_LENGTH - draft.length;
  const isAtLimit = remaining === 0;
  const isNearLimit = remaining <= 120;
  const canSave = trimmedDraft !== trimmedInitial && !isSaving;
  const isListening = speechState.status === 'listening';

  const counterColor = useMemo(() => {
    if (isAtLimit) return theme.colors.dangerInk;
    if (isNearLimit) return theme.colors.accentInk;
    return theme.colors.inkMuted;
  }, [isAtLimit, isNearLimit, theme.colors.accentInk, theme.colors.dangerInk, theme.colors.inkMuted]);

  function handleChangeText(nextValue: string) {
    setDraft(nextValue.slice(0, MAX_SESSION_NOTES_LENGTH));
    setLimitMessage(nextValue.length >= MAX_SESSION_NOTES_LENGTH ? 'Limit reached.' : null);
  }

  function handleVoicePress() {
    if (speechState.status === 'failed') {
      void retryVoice();
    } else if (isListening) {
      void stopVoice();
    } else if (speechState.status === 'idle') {
      setLimitMessage(null);
      void startVoice();
    }
  }

  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xs }}>
      <View style={styles.header}>
        <ReedText style={styles.title} variant="title">Session notes</ReedText>
        <ReedIconButton
          accessibilityLabel={speechState.status === 'failed' ? 'Retry note dictation' : isListening ? 'Stop note dictation' : 'Start note dictation'}
          disabled={isAtLimit || speechState.status === 'transcribing'}
          onPress={handleVoicePress}
          variant="ghost"
        >
          <View style={styles.voiceButtonContent}>
            <Ionicons
              color={String(speechState.status === 'failed' ? theme.colors.dangerInk : isListening ? theme.colors.accentInk : theme.colors.inkSecondary)}
              name={speechState.status === 'failed' ? 'refresh' : isListening ? 'stop' : speechState.status === 'transcribing' ? 'hourglass-outline' : 'mic-outline'}
              size={22}
            />
            {isListening ? <VoiceButtonMeter level={speechState.voiceLevel} /> : null}
          </View>
        </ReedIconButton>
        <ReedIconButton accessibilityLabel="Close session notes" onPress={onClose} variant="ghost">
          <Ionicons color={String(theme.colors.inkSecondary)} name="close" size={22} />
        </ReedIconButton>
      </View>

      <View style={[styles.inputShell, { backgroundColor: theme.colors.surfaceRaised }]}>
        <ReedSheetTextInput
          maxLength={MAX_SESSION_NOTES_LENGTH}
          multiline
          onChangeText={handleChangeText}
          placeholder="Write what mattered in this session."
          placeholderTextColor={String(theme.colors.inkMuted)}
          ref={inputRef}
          selectionColor={String(theme.colors.accent)}
          style={[styles.input, bareInputStyle, { color: theme.colors.ink, fontFamily: theme.typography.body.fontFamily }]}
          textAlignVertical="top"
          value={draft}
        />
        <ReedText style={[styles.counter, { color: counterColor }]} variant="caption">
          {draft.length}/{MAX_SESSION_NOTES_LENGTH}
        </ReedText>
      </View>
      {limitMessage ? <ReedText tone="muted" variant="caption">{limitMessage}</ReedText> : null}
      {speechState.error ? <ReedText accessibilityLiveRegion="polite" tone="danger" variant="caption">{speechState.error}</ReedText> : null}

      <ReedButton disabled={!canSave} label={isSaving ? 'Saving…' : 'Save notes'} onPress={() => void onSave(trimmedDraft)} />
    </View>
  );
}

function VoiceButtonMeter({ level }: { level: number }) {
  const { theme } = useReedTheme();
  const bars = [0.45, 0.8, 0.6].map(weight => 5 + Math.round(level * weight * 12));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.voiceMeter}>
      {bars.map((height, index) => (
        <View
          key={`${index}-${height}`}
          style={[
            styles.voiceMeterBar,
            {
              backgroundColor: theme.colors.accent,
              height,
              opacity: level > 0.04 ? 0.42 + (level * 0.5) : 0.22,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  title: {
    flex: 1,
  },
  counter: {
    bottom: 10,
    position: 'absolute',
    right: 14,
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
    height: 178,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  voiceButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
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
});
