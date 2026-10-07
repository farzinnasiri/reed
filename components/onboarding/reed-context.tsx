import { createContext, useContext, useEffect } from 'react';
import type { MascotController } from '@/components/reed/mascot';

// The flow owns one mascot. Controls borrow it so a tap nods, a pick gets a spoken reaction, and a
// focused field makes Reed look.

type OnboardingReed = {
  /** Focused profile editors borrow controls without the onboarding introduction. */
  editing?: boolean;
  reed: MascotController | null;
  setLetterReady: (ready: boolean) => void;
  setLetterDelivered: (delivered: boolean) => void;
  revealAnswer: () => void;
  stageViewportHeight: number;
  setAnswerPending: (pending: boolean) => void;
  setListening: (listening: boolean) => void;
  /** A short line from Reed, shown under the mascot for a moment. */
  say: (text: string, ms?: number) => void;
  /** The step's primary button runs this first (to accept a control's default). Pass null to clear. */
  setBeforeNext: (action: (() => void) | null) => void;
};

export const OnboardingReedContext = createContext<OnboardingReed>({ stageViewportHeight: 0, reed: null, setLetterReady: () => {}, setLetterDelivered: () => {}, revealAnswer: () => {}, setAnswerPending: () => {}, setListening: () => {}, say: () => {}, setBeforeNext: () => {} });

export function useOnboardingReed() {
  return useContext(OnboardingReedContext);
}

/** Focus and blur change Reed's expression while keeping the listening face centered. */
export function useFieldGaze() {
  const { reed, setListening } = useOnboardingReed();
  return {
    onFocus: () => {
      reed?.lookAt('center');
      setListening(true);
    },
    onBlur: () => {
      reed?.lookAt('center');
      setListening(false);
    },
  };
}

/** Registers what Continue should do before it moves on. Re-registers every render so it never goes stale. */
export function useBeforeNext(action: () => void) {
  const { setBeforeNext } = useOnboardingReed();
  useEffect(() => {
    setBeforeNext(action);
    return () => setBeforeNext(null);
  });
}
