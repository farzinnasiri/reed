import assert from 'node:assert/strict';
import test from 'node:test';
import { MASCOT_EXPRESSIONS } from '../components/reed/mascot/mascot-engine';
import { GREETING_COPY, RARE_GREETINGS, type Lines } from '../components/reed/today/greeting-copy';
import {
  NO_RECENT_GREETINGS,
  daypartTitle,
  pickGreeting,
  rememberGreeting,
  render,
  type GreetingContext,
} from '../components/reed/today/greeting';

type Day = 'done' | 'today' | 'none';
const week = (days: Day[], target: number | null = 4) => ({ count: days.filter(day => day === 'done').length, days, target });
const quiet: GreetingContext = {
  activeSession: false,
  firstName: 'Ana',
  hour: 9,
  // Wednesday: nothing logged, so only the neutral pool and "nothing yet" can apply by 9am.
  week: week(['none', 'none', 'today', 'none', 'none', 'none', 'none']),
  weekday: 3,
};
const seeds = Array.from({ length: 400 }, (_, seed) => seed);
const headers = (context: GreetingContext) => new Set(seeds.map(seed => pickGreeting(context, seed).used.header));
const allCopy = (id: keyof typeof GREETING_COPY) => GREETING_COPY[id].headers.map(header => header.text);

test('the same seed and context always give the same greeting', () => {
  for (const seed of seeds) assert.deepEqual(pickGreeting(quiet, seed), pickGreeting(quiet, seed));
  assert.ok(new Set(seeds.map(seed => JSON.stringify(pickGreeting(quiet, seed)))).size > 20);
});

test('a greeting never shows an unfilled placeholder and has a name only when the user has one', () => {
  const contexts: GreetingContext[] = [
    quiet,
    { ...quiet, firstName: null },
    { ...quiet, week: null },
    { ...quiet, hour: 2, weekday: 6 },
    { ...quiet, hour: 22, weekday: 0, week: week(['done', 'done', 'done', 'none', 'none', 'none', 'today'], 4) },
  ];
  for (const context of contexts) {
    for (const seed of seeds) {
      const { header, subheader } = pickGreeting(context, seed);
      for (const text of [header, subheader ?? '']) {
        assert.ok(!/[{}]/.test(text), text);
        assert.ok(!/ ,|,\s*[?!]?$|\s$/.test(text), text);
        if (context.firstName === null) assert.ok(!text.includes('Ana'), text);
      }
    }
  }
});

test('every header fits under the mascot and every template can be rendered by someone', () => {
  const vars = { name: 'Farzin', daypart: 'afternoon', target: '4', more: 'two more active days', week: 'x' };
  for (const lines of [...Object.values(GREETING_COPY).flatMap(entry => entry.headers), ...RARE_GREETINGS]) {
    const text = render(lines.text, vars, true);
    assert.ok(text !== null && text.length <= 32, `${lines.text} -> ${text}`);
    assert.ok(!text.includes('—'), text);
  }
});

test('situations only appear when their facts are true', () => {
  const sunday = (days: Day[], target = 4): GreetingContext => ({ ...quiet, hour: 15, weekday: 0, week: week(days, target) });
  const done = (...flags: Day[]) => flags;

  // Behind on Thursday with a reachable goal: "still time" lines. Nothing logged: fresh-start lines.
  const thursday: GreetingContext = { ...quiet, hour: 9, weekday: 4, week: week(done('done', 'none', 'done', 'today', 'none', 'none', 'none')) };
  assert.ok([...headers(thursday)].some(text => allCopy('behind-thu-sat').includes(text)));
  assert.ok([...headers({ ...quiet, week: week(done('none', 'none', 'today', 'none', 'none', 'none', 'none')) })].some(text => allCopy('nothing-midweek').includes(text)));
  assert.ok(![...headers(quiet)].some(text => allCopy('trained-today').includes(text)));

  // Saturday with three days still to find: out of reach, so no "there's still time".
  const hopeless: GreetingContext = { ...quiet, weekday: 6, week: week(done('done', 'none', 'none', 'none', 'none', 'today', 'none')) };
  assert.ok(![...headers(hopeless)].some(text => allCopy('behind-thu-sat').includes(text)));

  // Sunday needing exactly one: last call. Needing two: not.
  assert.ok([...headers(sunday(done('done', 'done', 'done', 'none', 'none', 'none', 'today')))].some(text => allCopy('behind-sunday').includes(text)));
  assert.ok(![...headers(sunday(done('done', 'done', 'none', 'none', 'none', 'none', 'today')))].some(text => text === 'Last call for the week'));

  // Trained today wins over the quiet pool, and an open workout is never "already done".
  const trained: GreetingContext = { ...quiet, week: week(done('none', 'none', 'done', 'none', 'none', 'none', 'none')) };
  assert.ok([...headers(trained)].some(text => allCopy('trained-today').includes(text)));
  assert.ok(![...headers({ ...trained, activeSession: true })].some(text => allCopy('trained-today').includes(text)));

  // Goal reached uses the real goal in the subheader.
  const reached: GreetingContext = { ...quiet, week: week(done('done', 'done', 'done', 'done', 'none', 'none', 'none'), 4) };
  assert.ok(seeds.some(seed => pickGreeting(reached, seed).subheader === '4 active days, as promised.'));
});

test('time of day and weekday decide the ambient lines', () => {
  assert.ok([...headers({ ...quiet, hour: 2 })].some(text => allCopy('late-night').includes(text)));
  assert.ok([...headers({ ...quiet, hour: 6 })].some(text => allCopy('early-morning').includes(text)));
  assert.ok(![...headers({ ...quiet, hour: 14 })].some(text => allCopy('late-night').includes(text)));
  assert.ok([...headers({ ...quiet, weekday: 1, hour: 9 })].some(text => allCopy('monday').includes(text)));
  // Day- and hour-specific headers stay in their lane.
  assert.ok(![...headers({ ...quiet, weekday: 0, hour: 9 })].some(text => text === 'Slow Saturday'));
  assert.ok(![...headers({ ...quiet, weekday: 6, hour: 20 })].some(text => text === 'No alarm clock today?'));
  assert.equal(daypartTitle('Ana', 8), 'Good morning, Ana');
  assert.equal(daypartTitle(null, 14), 'Good afternoon');
  assert.equal(daypartTitle(null, 3), 'Good evening');
});

test('one situation still gives many different greetings, with and without the extras', () => {
  const night: GreetingContext = { ...quiet, hour: 2 };
  const picks = seeds.map(seed => pickGreeting(night, seed));
  assert.ok(new Set(picks.map(pick => `${pick.header}|${pick.emoji}|${pick.subheader}`)).size > 40);
  assert.ok(picks.some(pick => pick.emoji) && picks.some(pick => !pick.emoji && pick.used.header.includes('Still up')));
  assert.ok(picks.some(pick => pick.subheader === null) && picks.some(pick => pick.subheader !== null));
  assert.ok(picks.some(pick => pick.header === 'Still up, Ana?') && picks.some(pick => pick.header === 'Still up?'));
});

test('a habitual opener still sees variety once recent lines are remembered', () => {
  const morning: GreetingContext = { ...quiet, hour: 6 };
  let recent = NO_RECENT_GREETINGS;
  const seen: string[] = [];
  for (let open = 0; open < 30; open++) {
    const greeting = pickGreeting(morning, 1000 + open, recent);
    seen.push(greeting.used.header);
    recent = rememberGreeting(recent, greeting);
  }
  assert.ok(new Set(seen).size >= 8, [...new Set(seen)].join(', '));
  // Back-to-back repeats are rare, not forbidden.
  assert.ok(seen.filter((header, index) => index > 0 && header === seen[index - 1]).length <= 2);
  assert.ok(recent.headers.length <= 10 && recent.subs.length <= 6);
});

test('rare greetings come with their own subheader and are rare', () => {
  const rare = seeds.map(seed => pickGreeting(quiet, seed * 7919)).filter(pick => RARE_GREETINGS.some(item => item.text === pick.used.header));
  assert.ok(rare.length > 0 && rare.length < seeds.length * 0.06, String(rare.length));
  for (const pick of rare) assert.ok(pick.subheader);
});

test('week information waits for the week, and the greeting still works without it', () => {
  for (const seed of seeds) {
    const { header, subheader } = pickGreeting({ ...quiet, week: null }, seed);
    assert.ok(header);
    assert.ok(!subheader?.includes('this week.') || !/\d/.test(subheader));
  }
  assert.ok(seeds.some(seed => pickGreeting(quiet, seed).subheader?.startsWith('Nothing logged yet this week')));
});

test('every greeting comes with a real face that fits it', () => {
  const known = new Set<string>(MASCOT_EXPRESSIONS);
  for (const lines of Object.values(GREETING_COPY) as Lines[]) {
    for (const face of lines.faces ?? []) assert.ok(known.has(face), face);
    for (const header of lines.headers) for (const face of header.face === undefined ? [] : [header.face].flat()) assert.ok(known.has(face), face);
  }
  for (const seed of seeds) assert.ok(known.has(pickGreeting(quiet, seed).expression));

  // The face follows the words: a late night drifts toward sleepy, a goal hit toward pride.
  const night = seeds.map(seed => pickGreeting({ ...quiet, hour: 2, weekday: 2 }, seed));
  assert.ok(night.filter(pick => pick.expression === 'sleepy').length > night.length / 5);
  assert.ok(night.every(pick => pick.used.header !== 'Still up{, name}?' || pick.expression === 'sleepy'));
  const reached = seeds.map(seed => pickGreeting({ ...quiet, week: week(['done', 'done', 'done', 'done', 'none', 'none', 'none'], 4) }, seed));
  assert.ok(reached.some(pick => pick.expression === 'proud'));
  // And the neutral pool still shows more than one face.
  assert.ok(new Set(seeds.map(seed => pickGreeting(quiet, seed).expression)).size >= 3);
});
