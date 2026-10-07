export type ComposerDraftSource = 'typed' | 'voice';
export type ComposerDraftSnapshot = { revision: number; text: string; source: ComposerDraftSource };

/** A single draft, shared by mounted editors without mirroring their local text. */
export function createComposerDraft() {
  let snapshot: ComposerDraftSnapshot = { revision: 0, text: '', source: 'typed' };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replace(text: string, source: ComposerDraftSource) {
      if (snapshot.text === text && snapshot.source === source) return;
      snapshot = { revision: snapshot.revision + 1, text, source };
      listeners.forEach((listener) => listener());
    },
  };
}
