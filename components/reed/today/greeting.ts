// The today greeting: a header, an optional emoji and an optional subheader. Deterministic given a
// seed, so opening the app never waits on a model and the greeting never reshuffles on re-render.
//
// 1. Work out which situations are true right now (late at night, Monday, you trained today...).
// 2. Draw one by weight. Recently seen lines count for less, so a user who always opens at the same
//    hour still sees variety. Neutral always keeps a floor of about a quarter.
// 3. Roll the pieces independently: name, emoji, subheader. Ambient situations borrow subheaders
//    from each other, so one situation produces many different greetings.
//
// The greeting also says which face Reed wears while it is on screen, so the words and the mascot
// agree. The lines and faces live in greeting-copy.ts.

import type { MascotExpression } from '../mascot/mascot-engine';
import type { MascotStep } from '../mascot/use-mascot';
import { GREETING_COPY, RARE_GREETINGS, type Header, type SituationId } from './greeting-copy';
import { createSeededRandom } from './seeded-random';

export type GreetingContext = {
  firstName: string | null;
  hour: number;
  /** 0 = Sunday. */
  weekday: number;
  /** Null while the week is unknown; situations that need it are then skipped. */
  week: { count: number; target: number | null; days: ('done' | 'today' | 'none')[] } | null;
  activeSession: boolean;
};

export type RecentGreetings = { headers: string[]; subs: string[] };
export const NO_RECENT_GREETINGS: RecentGreetings = { headers: [], subs: [] };

export type Greeting = {
  header: string;
  emoji: string | null;
  subheader: string | null;
  /** The face Reed wears with this greeting. */
  expression: MascotExpression;
  /** The copy templates used, to remember so they are not repeated soon. */
  used: { header: string; sub: string | null };
};

const REMEMBERED_HEADERS = 10;
const REMEMBERED_SUBS = 6;
const RARE_CHANCE = 0.02;
const NAME_CHANCE = 0.5;
const EMOJI_CHANCE = 0.5;
const SUBHEADER_CHANCE = 0.75;
const NEUTRAL_SHARE = 1 / 3; // neutral weight relative to the rest: about a quarter of draws
const RECENT_PENALTY = 0.1;
// The very last header, and the situation it came from, should almost never come straight back.
const LAST_HEADER_PENALTY = 0.02;
const LAST_SITUATION_PENALTY = 0.3;
const OWN_SUB_BONUS = 3;

type Facts = {
  trainedToday: boolean;
  trainedYesterday: boolean;
  count: number | null;
  target: number | null;
  /** Active days still needed to reach the goal. */
  left: number | null;
  /** Days of the week that remain, today included while it is still open. */
  daysLeft: number;
};

type Situation = { kind: 'state' | 'ambient'; weight: number; when: (context: GreetingContext, facts: Facts) => boolean };

// States are about what the user did or is doing and win over ambient ones, which only know the clock.
const SITUATIONS: Record<Exclude<SituationId, 'neutral'>, Situation> = {
  'goal-reached': { kind: 'state', weight: 6, when: (_c, f) => f.target !== null && f.count !== null && f.count >= f.target },
  'trained-today': { kind: 'state', weight: 6, when: (c, f) => f.trainedToday && !c.activeSession },
  yesterday: { kind: 'state', weight: 3, when: (c, f) => f.trainedYesterday && !f.trainedToday && !c.activeSession },
  // Only when the goal is still reachable: never promise "there's time" when there isn't.
  'behind-sunday': { kind: 'state', weight: 6, when: (c, f) => c.weekday === 0 && f.left === 1 && !f.trainedToday },
  'behind-thu-sat': {
    kind: 'state',
    weight: 5,
    when: (c, f) => c.weekday >= 4 && c.weekday <= 6 && (f.count ?? 0) > 0 && f.left !== null && f.left > 0 && f.left <= f.daysLeft,
  },
  'nothing-midweek': { kind: 'state', weight: 5, when: (c, f) => f.count === 0 && (c.weekday >= 3 || c.weekday === 0) && !c.activeSession },
  'late-night': { kind: 'ambient', weight: 3, when: c => c.hour < 5 },
  'early-morning': { kind: 'ambient', weight: 3, when: c => c.hour >= 5 && c.hour < 8 },
  midday: { kind: 'ambient', weight: 2, when: c => c.hour >= 11 && c.hour < 15 },
  afternoon: { kind: 'ambient', weight: 2, when: c => c.hour >= 15 && c.hour < 18 },
  evening: { kind: 'ambient', weight: 3, when: c => c.hour >= 21 },
  monday: { kind: 'ambient', weight: 3, when: c => c.weekday === 1 },
  friday: { kind: 'ambient', weight: 3, when: c => c.weekday === 5 },
  weekend: { kind: 'ambient', weight: 3, when: c => c.weekday === 0 || c.weekday === 6 },
};

/** How long Reed holds the greeting's face before relaxing back to how it feels now. */
export const GREETING_FACE_MS = 6000;

/** The greeting's face as a mascot step: drowsy faces arrive slowly and move slowly. */
export function greetingFaceStep(expression: MascotExpression): MascotStep {
  return expression === 'sleepy'
    ? { expression, ms: GREETING_FACE_MS, speed: 0.7, transition: 'slow' }
    : { expression, ms: GREETING_FACE_MS };
}

export function timeOfDay(hour: number) {
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
}

/** The plain fallback title, for when a coach note has no headline of its own. */
export function daypartTitle(firstName: string | null, hour: number) {
  return `Good ${timeOfDay(hour)}${firstName ? `, ${firstName}` : ''}`;
}

export function pickGreeting(context: GreetingContext, seed: number, recent: RecentGreetings = NO_RECENT_GREETINGS): Greeting {
  const random = createSeededRandom(seed);
  // Rolled up front so a seed means the same thing whichever branch is taken.
  const rolls = { rare: random(), name: random(), emoji: random(), sub: random(), face: random() };
  const useName = rolls.name < NAME_CHANCE;
  const vars = buildVars(context);
  const fits = (header: Header) => headerFits(header, context) && render(header.text, vars, useName) !== null;

  if (rolls.rare < RARE_CHANCE) {
    const rare = RARE_GREETINGS.filter(fits);
    if (rare.length > 0) return compose(draw(rare, header => recentWeight(recent.headers, header.text), random), ['idle'], null, rolls, vars, useName, true);
  }

  const facts = readFacts(context);
  const eligible = (Object.keys(SITUATIONS) as Exclude<SituationId, 'neutral'>[])
    .filter(id => SITUATIONS[id].when(context, facts))
    .map(id => ({ id, headers: GREETING_COPY[id].headers.filter(fits) }))
    .filter(situation => situation.headers.length > 0)
    .map(situation => ({
      ...situation,
      weight: SITUATIONS[situation.id].weight * freshness(situation.headers.map(header => header.text), recent.headers)
        * (situation.headers.some(header => header.text === recent.headers[0]) ? LAST_SITUATION_PENALTY : 1),
    }));
  const neutral = { id: 'neutral' as const, headers: GREETING_COPY.neutral.headers.filter(fits) };
  const rest = eligible.reduce((total, situation) => total + situation.weight, 0);
  const chosen = draw(
    [...eligible, { ...neutral, weight: Math.max(1, rest * NEUTRAL_SHARE) }],
    situation => situation.weight,
    random,
  );

  const header = draw(chosen.headers, item => recentWeight(recent.headers, item.text), random);

  // Specific situations keep to their own subheaders. Ambient and neutral ones can borrow from
  // each other, which is what keeps a habitual 7am user from seeing the same few lines.
  const own = GREETING_COPY[chosen.id].subs.map(text => ({ text, weight: OWN_SUB_BONUS }));
  const borrowed = chosen.id === 'neutral' || SITUATIONS[chosen.id].kind === 'ambient'
    ? [...eligible.filter(situation => SITUATIONS[situation.id].kind === 'ambient'), neutral]
      .flatMap(situation => GREETING_COPY[situation.id].subs.map(text => ({ text, weight: 1 })))
    : [];
  const subs = [...own, ...borrowed.filter(item => !own.some(candidate => candidate.text === item.text))]
    .filter(item => render(item.text, vars, useName) !== null);
  const sub = rolls.sub < SUBHEADER_CHANCE && subs.length > 0
    ? draw(subs, item => item.weight * recentWeight(recent.subs, item.text), random).text
    : null;

  return compose(header, GREETING_COPY[chosen.id].faces ?? ['idle'], sub, rolls, vars, useName, false);
}

/** The new recent list after showing a greeting: newest first, trimmed. */
export function rememberGreeting(recent: RecentGreetings, greeting: Greeting): RecentGreetings {
  const push = (list: string[], value: string | null, limit: number) =>
    value === null ? list : [value, ...list.filter(item => item !== value)].slice(0, limit);
  return {
    headers: push(recent.headers, greeting.used.header, REMEMBERED_HEADERS),
    subs: push(recent.subs, greeting.used.sub, REMEMBERED_SUBS),
  };
}

function compose(header: Header, defaultFaces: MascotExpression[], sub: string | null, rolls: { emoji: number; face: number }, vars: Vars, useName: boolean, pairedOnly: boolean): Greeting {
  const subTemplate = pairedOnly ? header.sub ?? null : sub;
  const faces = header.face === undefined ? defaultFaces : Array.isArray(header.face) ? header.face : [header.face];
  return {
    header: render(header.text, vars, useName) ?? header.text,
    emoji: header.emoji && rolls.emoji < EMOJI_CHANCE ? header.emoji : null,
    expression: faces[Math.min(faces.length - 1, Math.floor(rolls.face * faces.length))],
    subheader: subTemplate === null ? null : render(subTemplate, vars, useName),
    used: { header: header.text, sub: subTemplate },
  };
}

function readFacts(context: GreetingContext): Facts {
  const todayIndex = (context.weekday + 6) % 7; // weeks start on Monday
  const days = context.week?.days;
  const trainedToday = days?.[todayIndex] === 'done';
  const count = context.week?.count ?? null;
  const target = context.week?.target ?? null;
  return {
    trainedToday,
    // On Monday yesterday belongs to last week, which the week strip does not cover.
    trainedYesterday: todayIndex > 0 && days?.[todayIndex - 1] === 'done',
    count,
    target,
    left: count !== null && target !== null ? Math.max(0, target - count) : null,
    daysLeft: (context.weekday === 0 ? 1 : 8 - context.weekday) - (trainedToday ? 1 : 0),
  };
}

type Vars = Record<string, string | null>;

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function buildVars(context: GreetingContext): Vars {
  const { count, left, target } = readFacts(context);
  const more = left !== null && left > 0
    ? `${NUMBER_WORDS[left] ?? left} more active ${left === 1 ? 'day' : 'days'}`
    : null;
  return {
    name: context.firstName,
    daypart: timeOfDay(context.hour),
    target: target === null ? null : String(target),
    more,
    week: count === null ? null : describeWeek(count, target),
  };
}

function describeWeek(count: number, target: number | null) {
  if (target !== null && count >= target) return `You have reached your goal of ${formatDays(target)} this week.`;
  if (count === 0) return target !== null ? `Nothing logged yet this week. Your goal is ${formatDays(target)}.` : 'Nothing logged yet this week.';
  return target !== null ? `${count} of ${formatDays(target)} so far this week.` : `${formatDays(count)} so far this week.`;
}

function formatDays(count: number) {
  return `${count} active ${count === 1 ? 'day' : 'days'}`;
}

/** Fills a template, or returns null when a placeholder it needs has no value. */
export function render(template: string, vars: Vars, useName: boolean): string | null {
  let missing = false;
  const text = template
    .replace(/\{, name\}/g, useName && vars.name ? `, ${vars.name}` : '')
    .replace(/\{(\w+)\}/g, (_match, key: string) => {
      const lower = key.charAt(0).toLowerCase() + key.slice(1);
      const value = vars[lower];
      if (value === null || value === undefined) {
        missing = true;
        return '';
      }
      return key === lower ? value : value.charAt(0).toUpperCase() + value.slice(1);
    });
  return missing ? null : text;
}

function headerFits(header: Header, context: GreetingContext) {
  if (header.days && !header.days.includes(context.weekday)) return false;
  if (header.hours && (context.hour < header.hours[0] || context.hour >= header.hours[1])) return false;
  return true;
}

function recentWeight(recent: string[], key: string) {
  return recent[0] === key ? LAST_HEADER_PENALTY : recent.includes(key) ? RECENT_PENALTY : 1;
}

/** 1 when every line is fresh, down to a tenth when all have been seen lately. */
function freshness(keys: string[], recent: string[]) {
  const fresh = keys.filter(key => !recent.includes(key)).length;
  return 0.1 + 0.9 * (fresh / keys.length);
}

function draw<T>(items: T[], weightOf: (item: T) => number, random: () => number): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let threshold = random() * total;
  for (const item of items) {
    threshold -= weightOf(item);
    if (threshold < 0) return item;
  }
  return items[items.length - 1];
}
