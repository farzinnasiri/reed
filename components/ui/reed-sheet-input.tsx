import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { Ref } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';

/**
 * A text input for use inside a `ReedSheet`. On a phone it is gorhom's input, which lets the sheet
 * keep the focused field above the keyboard. On web gorhom's input throws when it loses focus (it
 * calls `TextInput.State.currentlyFocusedInput`, which react-native-web does not have), and the
 * browser already scrolls a focused field into view, so web gets the plain input.
 */
export function ReedSheetTextInput({ ref, ...props }: TextInputProps & { ref?: Ref<TextInput> }) {
  if (Platform.OS === 'web') return <TextInput ref={ref} {...props} />;
  return <BottomSheetTextInput {...props} ref={ref as never} />;
}
