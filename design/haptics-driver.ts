import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { HapticMoment } from './haptic-policy';

const android: Record<HapticMoment, Haptics.AndroidHaptics> = {
  selection: Haptics.AndroidHaptics.Segment_Tick,
  toggleOn: Haptics.AndroidHaptics.Toggle_On,
  toggleOff: Haptics.AndroidHaptics.Toggle_Off,
  detent: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  settled: Haptics.AndroidHaptics.Segment_Tick,
  acknowledge: Haptics.AndroidHaptics.Virtual_Key,
  saved: Haptics.AndroidHaptics.Confirm,
  completed: Haptics.AndroidHaptics.Confirm,
  reply: Haptics.AndroidHaptics.Context_Click,
  attention: Haptics.AndroidHaptics.Long_Press,
  error: Haptics.AndroidHaptics.Reject,
  play: Haptics.AndroidHaptics.Context_Click,
};

export function deliverHaptic(moment: HapticMoment) {
  // Android's view feedback respects system settings, unlike raw vibration fallbacks.
  const result = Platform.OS === 'android'
    ? Haptics.performAndroidHapticsAsync(android[moment])
    : moment === 'selection' || moment === 'detent' || moment === 'settled' || moment.startsWith('toggle')
      ? Haptics.selectionAsync()
      : moment === 'completed'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : moment === 'error'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          : Haptics.impactAsync(moment === 'play' ? Haptics.ImpactFeedbackStyle.Soft : Haptics.ImpactFeedbackStyle.Light);
  void result.catch(() => {});
}
