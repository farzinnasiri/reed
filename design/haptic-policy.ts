/** Policy is independent of hardware so disabled, hidden and duplicate events stay silent. */
export type HapticMoment = 'selection' | 'toggleOn' | 'toggleOff' | 'detent' | 'settled' | 'acknowledge' | 'saved' | 'completed' | 'reply' | 'attention' | 'error' | 'play';

export const reedHaptics = {
  intervalMs: 80,
  detentIntervalMs: 65,
  pickerSettleMs: 120,
  web: {
    selection: 12, toggleOn: 12, toggleOff: 12, settled: 12,
    acknowledge: 15, saved: 20, completed: [18, 65, 18], reply: 15,
    attention: [18, 90, 18], error: [15, 65, 15], play: 10,
  },
} as const;

export function createHapticPolicy(deliver: (moment: HapticMoment) => void, now = Date.now) {
  let ready = false;
  let enabled = true;
  let active = true;
  let reduced = false;
  let foregroundSince = -Infinity;
  let lastAt = -Infinity;
  let revision = 0;
  const seen = new Set<string>();
  const listeners = new Set<() => void>();
  function changed() { revision++; for (const listener of listeners) listener(); }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => revision,
    preference: () => ({ ready, enabled }),
    hydrate(value: boolean) { if (ready) return; enabled = value; ready = true; changed(); },
    setEnabled(value: boolean) { enabled = value; ready = true; changed(); },
    setActive(value: boolean) { if (!active && value) foregroundSince = now(); active = value; },
    setReduced(value: boolean) { reduced = value; },
    available: () => ready && enabled && active,
    emit(moment: HapticMoment, key?: string, occurredAt?: number) {
      // Consume arrivals even when muted/hidden: changing preference never replays them.
      if (key) {
        if (seen.has(key)) return false;
        seen.add(key);
        if (seen.size > 256) seen.delete(seen.values().next().value!);
      }
      if (occurredAt !== undefined && occurredAt < foregroundSince) return false;
      if (!ready || !enabled || !active || (reduced && moment === 'play')) return false;
      const at = now();
      if (at - lastAt < (moment === 'detent' ? reedHaptics.detentIntervalMs : reedHaptics.intervalMs)) return false;
      lastAt = at;
      try { deliver(moment); } catch { /* Feedback must never interrupt the action. */ }
      return true;
    },
  };
}
