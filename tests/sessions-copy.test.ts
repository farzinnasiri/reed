import assert from 'node:assert/strict';
import test from 'node:test';
import { pickRecapLine, pickSessionsLine, sessionsSituation, type SessionsContext } from '../components/workout/sessions-copy';

const quiet: SessionsContext = { live: false, hasHistory: true, trainedToday: false, weekCount: 1, weekTarget: 3, daysSinceLast: 2 };

test('the Sessions line follows the facts, most specific first', () => {
  assert.equal(sessionsSituation({ ...quiet, live: true, hasHistory: false }), 'live');
  assert.equal(sessionsSituation({ ...quiet, live: true, stale: true }), 'stale');
  assert.equal(sessionsSituation({ ...quiet, hasHistory: false }), 'empty');
  assert.equal(sessionsSituation({ ...quiet, hasHistory: null }), 'default');
  assert.equal(sessionsSituation({ ...quiet, weekCount: 3, trainedToday: true }), 'goal-reached');
  assert.equal(sessionsSituation({ ...quiet, trainedToday: true }), 'trained-today');
  assert.equal(sessionsSituation({ ...quiet, daysSinceLast: 6 }), 'been-a-while');
  assert.equal(sessionsSituation({ ...quiet, weekTarget: null, weekCount: null }), 'default');
});

test('a seed holds a line still and different seeds vary it', () => {
  assert.deepEqual(pickSessionsLine(quiet, 7), pickSessionsLine(quiet, 7));
  const seen = new Set(Array.from({ length: 40 }, (_, seed) => pickSessionsLine(quiet, seed).text));
  assert.ok(seen.size > 1);
});

test('the recap line notices records, then a big session, then a short one', () => {
  const lines = (facts: Parameters<typeof pickRecapLine>[0]) => new Set(Array.from({ length: 30 }, (_, seed) => pickRecapLine(facts, seed).text));
  const record = lines({ prCount: 1, sets: 24, minutes: 15 });
  const big = lines({ prCount: 0, sets: 24, minutes: 70 });
  const short = lines({ prCount: 0, sets: 6, minutes: 15 });
  const ordinary = lines({ prCount: 0, sets: 6, minutes: 45 });
  assert.ok([...record].every(text => /record|best/i.test(text)));
  assert.deepEqual(lines({ prCount: 0, sets: 24, minutes: 15 }), big);
  assert.equal([...big].some(text => short.has(text) || ordinary.has(text) || record.has(text)), false);
  assert.equal([...short].some(text => ordinary.has(text)), false);
  const bigFacts = { prCount: 0, sets: 24, minutes: 70 };
  assert.equal(pickRecapLine(bigFacts, 4).text, pickRecapLine(bigFacts, 4).text);
  assert.ok(new Set(Array.from({ length: 20 }, (_, seed) => pickRecapLine(bigFacts, seed).text)).size > 1);
});

test('Reed never nags or shouts', () => {
  const texts = new Set<string>();
  for (let seed = 0; seed < 60; seed += 1) {
    texts.add(pickSessionsLine({ ...quiet, live: seed % 2 === 0 }, seed).text);
    texts.add(pickRecapLine({ prCount: seed % 3, sets: seed, minutes: seed }, seed).text);
  }
  for (const text of texts) assert.doesNotMatch(text, /!|streak|missed|behind|lazy/i);
});
