import { createContext, useContext, type ReactNode } from 'react';
import { ReedComposerDraftProvider } from './reed-composer-context';
import { useReedConversation } from './use-reed-conversation';

const Context = createContext<ReturnType<typeof useReedConversation> | null>(null);
/** One optimistic turn owner for every authenticated Reed surface. */
export function ReedConversationProvider({ children }: { children: ReactNode }) {
  const conversation = useReedConversation();
  return <Context.Provider value={conversation}><ReedComposerDraftProvider>{children}</ReedComposerDraftProvider></Context.Provider>;
}
export function useSharedReedConversation() {
  const value = useContext(Context);
  if (!value) throw new Error('Reed conversation must be inside the authenticated app shell.');
  return value;
}
