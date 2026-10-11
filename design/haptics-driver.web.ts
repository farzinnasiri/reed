import { reedHaptics, type HapticMoment } from './haptic-policy';

export function isIPhoneSwitchAvailable() {
  return typeof document !== 'undefined' && typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod/.test(navigator.userAgent)
    && 'switch' in document.createElement('input');
}

export function deliverHaptic(moment: HapticMoment) {
  // iOS has no imperative haptic API. Its native switch tick comes from a trusted tap.
  if (typeof navigator === 'undefined' || typeof document === 'undefined'
    || document.visibilityState !== 'visible' || !/Android/.test(navigator.userAgent)
    || typeof navigator.vibrate !== 'function'
    || (navigator.userActivation && !navigator.userActivation.hasBeenActive)
    || moment === 'detent') return;
  const pattern = reedHaptics.web[moment];
  try { navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern]); } catch { /* Unsupported hardware is silent. */ }
}
