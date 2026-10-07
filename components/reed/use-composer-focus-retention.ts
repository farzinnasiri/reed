import { useEffect, type RefObject } from 'react';
import { Platform, type TextInput, type View } from 'react-native';

/** Browser focus can scroll an overflow-hidden sheet host during its opening animation. */
export function restoreHiddenComposerAncestors(input: TextInput | null) {
  if (Platform.OS !== 'web') return;
  let element = (input as unknown as HTMLElement | null)?.parentElement;
  while (element) {
    const style = getComputedStyle(element);
    if (style.overflowY === 'hidden' && element.scrollTop) element.scrollTop = 0;
    if (style.overflowX === 'hidden' && element.scrollLeft) element.scrollLeft = 0;
    element = element.parentElement;
  }
}

/** Browser focus happens before Pressable's press-in event. Keep it on the editor. */
export function useComposerFocusRetention(ref: RefObject<View | null>, enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const element = ref.current as unknown as HTMLElement | null;
    if (!element?.addEventListener) return;
    const retain = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[role="button"]')) event.preventDefault();
    };
    element.addEventListener('mousedown', retain);
    return () => element.removeEventListener('mousedown', retain);
  }, [enabled, ref]);
}
