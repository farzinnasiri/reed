import { Pressable, type PressableProps } from 'react-native';
import * as haptics from '@/design/haptics';

export type HapticPressableProps = PressableProps & {
  feedback?: boolean | 'direct';
  'aria-pressed'?: boolean | 'mixed';
  /** The current value for a real boolean toggle; other controls use selection. */
  hapticValue?: boolean;
  /**
   * Web only. Set false when a parent gesture, such as swipe-to-delete, must receive the touch.
   * The iPhone switch input would otherwise sit on top of the control.
   */
  systemSwitch?: boolean;
};

export function HapticPressable({ feedback = true, hapticValue, systemSwitch: _systemSwitch, onPress, ...props }: HapticPressableProps) {
  return <Pressable {...props} onPress={event => {
    if (feedback === true) {
      if (hapticValue === undefined) haptics.selection();
      else haptics.toggle(!hapticValue);
    }
    onPress?.(event);
  }} />;
}
