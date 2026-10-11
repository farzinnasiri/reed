// What Reed says on the Sessions page and at the top of a finished session. Worked out from facts the
// page already has, with a seed so the line holds still for a visit; no model call. Edit freely.
// Same voice as the home greeting: human, no guilt, no streak language, no exclamation marks.

import type { MascotExpression } from '../reed/mascot/mascot-engine';
import { createSeededRandom } from '../reed/today/seeded-random';

type Said = { text: string; face: MascotExpression };

const SESSIONS_LINES = {
  stale: { faces: ['concerned', 'encouraging'], lines: ["That session's been open a long while. Let's close it out.", 'An old session is still open. Finish it and we can fix the time.'] },
  live: { faces: ['focused', 'ready'], lines: ["Your session's still open.", 'Pick up where you left off.', "Still going. I'm here."] },
  empty: { faces: ['encouraging', 'curious'], lines: ['Nothing here yet. Your first session starts the list.', 'A blank page. Start empty and add as you go.'] },
  'goal-reached': { faces: ['proud', 'happy'], lines: ["The week's goal is done. Anything now is a bonus.", "That's the target. Rest counts too."] },
  'trained-today': { faces: ['relieved', 'proud'], lines: ["Today's already in the bank.", 'Done for today. Nice one.'] },
  'been-a-while': { faces: ['encouraging', 'curious'], lines: ["It's been a few days. Start small.", 'No catching up needed. One session is plenty.'] },
  default: { faces: ['ready', 'curious', 'idle'], lines: ['Ready when you are.', 'Start empty and add as you go.', 'What are we training?'] },
} satisfies Record<string, { faces: MascotExpression[]; lines: string[] }>;

export type SessionsSituation = keyof typeof SESSIONS_LINES;

export type SessionsContext = {
  /** A session is open right now. */
  live: boolean;
  /** ...and has been open so long it was most likely forgotten. */
  stale?: boolean;
  /** At least one finished session exists. Unknown (`null`) until the first page has loaded. */
  hasHistory: boolean | null;
  trainedToday: boolean;
  weekCount: number | null;
  weekTarget: number | null;
  /** Whole days since the last finished session, if there was one. */
  daysSinceLast: number | null;
};

export function sessionsSituation(context: SessionsContext): SessionsSituation {
  if (context.live) return context.stale ? 'stale' : 'live';
  if (context.hasHistory === false) return 'empty';
  if (context.weekTarget !== null && context.weekCount !== null && context.weekCount >= context.weekTarget) return 'goal-reached';
  if (context.trainedToday) return 'trained-today';
  if (context.daysSinceLast !== null && context.daysSinceLast >= 5) return 'been-a-while';
  return 'default';
}

export function pickSessionsLine(context: SessionsContext, seed: number): Said {
  const { faces, lines } = SESSIONS_LINES[sessionsSituation(context)];
  const random = createSeededRandom(seed);
  return { text: lines[Math.floor(random() * lines.length)], face: faces[Math.floor(random() * faces.length)] };
}

const RECAP_LINES = {
  record: { faces: ['proud', 'excited'], lines: ['You set a record in this one.', 'A personal best in here. Nice.'] },
  big: { faces: ['relieved', 'proud'], lines: ['A big one.', 'That was a lot of work.'] },
  short: { faces: ['happy', 'wink'], lines: ['Short and useful.', 'A quick one. They count.'] },
  default: { faces: ['happy', 'relieved'], lines: ['Logged and done.', 'Good work.', "That's one for the books."] },
} satisfies Record<string, { faces: MascotExpression[]; lines: string[] }>;

const BIG_SESSION_SETS = 20;
const SHORT_SESSION_MINUTES = 20;

export function pickRecapLine(facts: { prCount: number; sets: number; minutes: number }, seed: number): Said {
  const key = facts.prCount > 0 ? 'record' : facts.sets >= BIG_SESSION_SETS ? 'big' : facts.sets > 0 && facts.minutes <= SHORT_SESSION_MINUTES ? 'short' : 'default';
  const { faces, lines } = RECAP_LINES[key];
  const random = createSeededRandom(seed);
  return { text: lines[Math.floor(random() * lines.length)], face: faces[Math.floor(random() * faces.length)] };
}
