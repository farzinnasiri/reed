import { useEffect, useRef, useState } from 'react';
import { reedMotion } from '@/design/motion';
import type { MascotExpression } from '../mascot';

/** Authored waiting copy, never model reasoning, tool activity or estimated progress. */
export const REED_THINKING_LINES = [
  'Thinking',
  'Thinking it through',
  'Working through it',
  'Putting it together',
  'Weighing the options',
  'Finding the right words',
  'Getting to the point',
  'Keeping it practical',
  'Making it clear',
  'Considering the details',
  'Looking at the whole picture',
  'Connecting the pieces',
  'Keeping your goal in view',
  'Finding a useful angle',
  'Shaping the answer',
  'Keeping it grounded',
  'Keeping it doable',
  'Looking for the simple route',
  'Staying with your question',
  'Making sense of it',
] as const;

/** Used only after the backend reports a failed model attempt. */
export const REED_RECOVERY_LINES = [
  'Give me a second, mate.',
  'Let me give that another go.',
  "Hang tight. I'm still here.",
  "One moment. I'm on it.",
  'Bear with me for a second.',
  'Still with you. Give me a moment.',
] as const;

// The existing non-facial glyphs all read as indeterminate activity. No smiles, alarms,
// celebration or progress meters while the answer is unknown.
const THINKING_GLYPHS = ['thinking', 'focused', 'thinking', 'typing'] as const satisfies readonly MascotExpression[];

export function thinkingLineForStep(step: number, offset: number) {
  if (step === 0) return REED_THINKING_LINES[0];
  const count = REED_THINKING_LINES.length - 1;
  return REED_THINKING_LINES[1 + ((offset + step - 1) % count)];
}

/** One clock per pending run. Hidden surfaces stop scheduling; completion hides copy immediately. */
export function usePendingPresence({ active, pending, recovering = false, transcribing, varyGlyphs }: {
  active: boolean;
  pending: boolean;
  recovering?: boolean;
  transcribing: boolean;
  varyGlyphs: boolean;
}) {
  const run = useRef<{ kind: string; startedAt: number; offset: number } | null>(null);
  const [tick, setTick] = useState<{ kind: string; startedAt: number; offset: number; at: number } | null>(null);
  const kind = transcribing ? 'transcribing' : pending ? recovering ? 'recovery' : 'reply' : null;
  const hintDelayMs = kind === 'recovery' ? 0 : reedMotion.presence.hintDelayMs;
  const [previousKind, setPreviousKind] = useState(kind);
  if (previousKind !== kind) {
    setPreviousKind(kind);
    setTick(null);
  }

  useEffect(() => {
    if (kind === null) {
      run.current = null;
      return;
    }
    if (run.current?.kind !== kind) {
      run.current = { kind, startedAt: Date.now(), offset: Math.floor(Math.random() * (kind === 'recovery' ? REED_RECOVERY_LINES.length : REED_THINKING_LINES.length - 1)) };
    }
    if (!active) return;
    const current = run.current;
    let timer: ReturnType<typeof setTimeout>;
    function advance() {
      const at = Date.now();
      setTick({ ...current, at });
      const age = at - current.startedAt;
      const { thinkingStepMs } = reedMotion.presence;
      // Keep the first delayed hint and subsequent changes aligned to this run, including resume.
      const nextStep = age < hintDelayMs ? hintDelayMs : hintDelayMs + (Math.floor((age - hintDelayMs) / thinkingStepMs) + 1) * thinkingStepMs;
      timer = setTimeout(advance, Math.max(1, nextStep - age));
    }
    advance();
    return () => clearTimeout(timer);
  }, [active, hintDelayMs, kind]);

  const age = tick?.kind === kind ? Math.max(0, tick.at - tick.startedAt) : 0;
  const step = Math.max(0, Math.floor((age - hintDelayMs) / reedMotion.presence.thinkingStepMs));
  const visible = active && kind !== null && tick?.kind === kind && age >= hintDelayMs;
  return {
    hint: visible ? transcribing ? 'Transcribing' : kind === 'recovery' ? REED_RECOVERY_LINES[(tick.offset + step) % REED_RECOVERY_LINES.length] : thinkingLineForStep(step, tick.offset) : null,
    expression: varyGlyphs && visible && !transcribing ? THINKING_GLYPHS[step % THINKING_GLYPHS.length] : 'thinking',
  };
}
