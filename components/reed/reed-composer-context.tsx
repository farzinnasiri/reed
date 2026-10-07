import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createComposerDraft } from '@/lib/composer-draft';
import { useSpeechDraft } from '@/lib/speech/use-speech-draft';
import { useReedAttachments } from './use-reed-attachments';

function useComposerOwner() {
  const [store] = useState(createComposerDraft);
  const { replace, subscribe, getSnapshot } = store;
  const attachments = useReedAttachments();
  const receiveTranscript = useCallback((transcript: string) => {
    const text = store.getSnapshot().text;
    replace(text.trim() ? `${text.trimEnd()} ${transcript}` : transcript, 'voice');
  }, [replace, store]);
  const speech = useSpeechDraft('chat', receiveTranscript);
  const { reset, retry, start, stop, state: { error, status, voiceLevel } } = speech;
  const voice = useMemo(() => ({ reset, retry, start, stop, state: { error, status, voiceLevel: 0 } }), [error, reset, retry, start, status, stop]);
  const owner = useMemo(
    () => ({
      getSnapshot,
      replace,
      subscribe,
      attachments,
      voice,
    }),
    [attachments, getSnapshot, replace, subscribe, voice],
  );
  return { owner, voiceLevel };
}
const VoiceLevelContext = createContext(0);
export function useComposerVoiceLevel() { return useContext(VoiceLevelContext); }
const Context = createContext<ReturnType<typeof useComposerOwner>['owner'] | null>(null);
export function ReedComposerDraftProvider({ children }: { children: ReactNode }) {
  const { owner, voiceLevel } = useComposerOwner();
  return <Context.Provider value={owner}><VoiceLevelContext.Provider value={voiceLevel}>{children}</VoiceLevelContext.Provider></Context.Provider>;
}
/** All editors subscribe to the same authoritative draft. */
export function useSharedComposerDraft() {
  const owner = useContext(Context);
  if (!owner) throw new Error('Reed composer must be inside the authenticated app shell.');
  const seed = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  return { ...owner, seed };
}
