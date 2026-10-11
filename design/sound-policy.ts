export type SoundMoment = 'workoutStart' | 'workoutComplete' | 'restComplete' | 'reply' | 'saved' | 'onboardingComplete';

export const reedSounds = {
  intervalMs: 700,
  expiryMs: 1000,
  volume: { workoutStart: 0.28, workoutComplete: 0.26, restComplete: 1, reply: 0.12, saved: 0.14, onboardingComplete: 0.24 },
} as const;

/** Only current outcomes can play. Muting, hiding or recording cancels pending audio too. */
export function createSoundPolicy(
  deliver: (moment: SoundMoment, current: () => boolean) => Promise<boolean>,
  stop: () => void,
  now = Date.now,
) {
  let ready = false;
  let enabled = true;
  let active = false;
  let foregroundSince = -Infinity;
  let lastAt = -Infinity;
  let lastMoment: SoundMoment | undefined;
  let generation = 0;
  let revision = 0;
  // A start the person just triggered, held until playback works. Null means nothing is waiting.
  let pendingStart: { key?: string } | null = null;
  const recordingOwners = new Set<symbol>();
  const seen = new Set<string>();
  const listeners = new Set<() => void>();
  const available = () => ready && enabled && active && recordingOwners.size === 0;
  const cancel = () => { generation++; stop(); };
  const changed = () => { revision++; for (const listener of listeners) listener(); };
  const consume = (key?: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    if (seen.size > 256) seen.delete(seen.values().next().value!);
  };
  const dropPendingStart = () => {
    consume(pendingStart?.key);
    pendingStart = null;
  };
  async function emit(moment: SoundMoment, key?: string, occurredAt?: number): Promise<boolean> {
    if (key && seen.has(key)) return false;
    const stale = occurredAt !== undefined && occurredAt < foregroundSince;
    const blocked = !enabled || !active || recordingOwners.size > 0 || stale;
    // Not loaded yet is temporary for a start chime. Muted, hidden, recorded and old arrivals stay consumed.
    if (blocked || !ready) {
      if (moment === 'workoutStart' && !ready && !blocked) pendingStart = { key };
      else {
        consume(key);
        if (moment === 'workoutStart') pendingStart = null;
      }
      return false;
    }
    const at = now();
    // A useful workout/timer outcome may replace a quiet reply, never the reverse.
    if (at - lastAt < reedSounds.intervalMs && !(lastMoment === 'reply' && moment !== 'reply')) {
      if (moment === 'workoutStart') pendingStart = { key };
      else consume(key);
      return false;
    }
    const previousAt = lastAt;
    const previousMoment = lastMoment;
    lastAt = at; lastMoment = moment;
    const ticket = ++generation;
    const current = () => ticket === generation && available() && now() - at <= reedSounds.expiryMs;
    const releaseAttempt = () => { lastAt = previousAt; lastMoment = previousMoment; };
    try {
      const played = await deliver(moment, current);
      if (!played) releaseAttempt();
      if (played || moment !== 'workoutStart' || !available()) {
        consume(key);
        if (moment === 'workoutStart') pendingStart = null;
      } else pendingStart = { key };
      return played;
    } catch {
      releaseAttempt();
      if (moment === 'workoutStart' && available()) pendingStart = { key };
      else consume(key);
      return false;
    }
  }
  let flushing: Promise<boolean> | null = null;
  function flushPendingStart() {
    if (flushing) return flushing;
    if (!pendingStart || !available()) return Promise.resolve(false);
    const pending = pendingStart;
    pendingStart = null;
    flushing = emit('workoutStart', pending.key).finally(() => { flushing = null; });
    return flushing;
  }
  return {
    available,
    preference: () => ({ ready, enabled }),
    snapshot: () => revision,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    hydrate(value: boolean) {
      if (ready) return;
      ready = true; enabled = value; changed();
      if (value) void flushPendingStart(); else dropPendingStart();
    },
    setEnabled(value: boolean) {
      ready = true; enabled = value;
      if (!value) { cancel(); dropPendingStart(); }
      changed();
      if (value) void flushPendingStart();
    },
    setActive(value: boolean) {
      if (!active && value) foregroundSince = now();
      active = value;
      if (!value) { cancel(); dropPendingStart(); }
      else void flushPendingStart();
    },
    setRecording(owner: symbol, value: boolean) {
      if (value) { recordingOwners.add(owner); cancel(); dropPendingStart(); }
      else { recordingOwners.delete(owner); void flushPendingStart(); }
    },
    retryPending: () => flushPendingStart(),
    emit,
  };
}
