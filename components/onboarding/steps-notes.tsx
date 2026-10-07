import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { MAX_COACH_NOTES_LENGTH } from '@/domains/profile/onboarding';
import { useSpeechDraft } from '@/lib/speech/use-speech-draft';
import { Field, Heading } from './controls';
import { useOnboardingReed } from './reed-context';
import type { StepProps } from './step-props';

export function NotesStep({ draft, update }: StepProps) {
  const { theme } = useReedTheme();
  const { setAnswerPending, setListening } = useOnboardingReed();
  const notes = useRef(draft.notes);
  useEffect(() => { notes.current = draft.notes; }, [draft.notes]);
  const [limitReached, setLimitReached] = useState(false);
  const append = useCallback((text: string) => {
    const combined = [notes.current.trimEnd(), text.trim()].filter(Boolean).join('\n');
    setLimitReached(combined.length > MAX_COACH_NOTES_LENGTH);
    update({ notes: combined.slice(0, MAX_COACH_NOTES_LENGTH) });
  }, [update]);
  const voice = useSpeechDraft('onboarding_notes', append);
  const recording = voice.state.status === 'listening';
  const transcribing = voice.state.status === 'transcribing';
  useEffect(() => {
    setAnswerPending(recording || transcribing);
    setListening(recording);
    return () => { setAnswerPending(false); setListening(false); };
  }, [recording, transcribing, setAnswerPending, setListening]);

  return <>
    <Heading title="Anything else I should know as your coach?" />
    <Field accessibilityLabel="Anything else for your coach" multiline maxLength={MAX_COACH_NOTES_LENGTH} value={draft.notes} placeholder="Anything you’d like to add…" onChangeText={text => { update({ notes: text }); setLimitReached(false); }} />
    <View style={styles.voice}>
      <ReedText tone="secondary" variant="caption" accessibilityLiveRegion="polite">{recording ? 'Listening. Tap to finish.' : transcribing ? 'Transcribing…' : 'Or tell me.'}</ReedText>
      <ReedIconButton accessibilityLabel={recording ? 'Finish recording' : 'Record a voice note'} disabled={transcribing} onPress={() => { haptics.selection(); void (recording ? voice.stop() : voice.start()); }}>
        <Ionicons name={recording ? 'stop' : 'mic-outline'} size={22} color={String(recording ? theme.colors.dangerInk : theme.colors.accentInk)} />
      </ReedIconButton>
    </View>
    {voice.state.status === 'failed' ? <View style={styles.error}>
      <ReedText tone="danger" variant="caption">{voice.state.error}</ReedText>
      <ReedButton label="Retry transcription" variant="quiet" onPress={() => { void voice.retry(); }} />
    </View> : null}
    {limitReached ? <ReedText tone="muted" variant="caption">Transcript shortened to fit. You can edit it above.</ReedText> : null}
  </>;
}
const styles = StyleSheet.create({
  voice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  error: { gap: 8 },
});
