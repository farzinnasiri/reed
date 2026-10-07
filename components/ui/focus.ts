import { Platform, type TextStyle } from 'react-native';

export function blurActiveElementOnWeb() {
  if (typeof document === 'undefined') {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
}

/**
 * For a bare text input inside a field that draws its own shape: the field is the focus indicator,
 * so the browser's own box would double it. React Native's types only allow visible outline
 * styles, so this web-only value is cast.
 */
export const bareInputStyle: TextStyle | null = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
