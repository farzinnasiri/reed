import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * The DESIGN.md haptic table in one place. Fire-and-forget; no-ops on web.
 * Workout haptics keep their own call sites.
 */
const isSupported = Platform.OS !== 'web';

/** Chip tap, stepper tap, segment change. */
export function selection() {
  if (isSupported) void Haptics.selectionAsync();
}

/** Pulse opens, message sent. */
export function light() {
  if (isSupported) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Weigh-in saved, quick log saved. */
export function success() {
  if (isSupported) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** A message could not be committed. Once per failed attempt. */
export function warning() {
  if (isSupported) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Optional mascot hold reaches its threshold. */
export function soft() {
  if (isSupported) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}
/** Optional mascot squish releases. */
export function medium() {
  if (isSupported) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
