import assert from 'node:assert/strict';
import test from 'node:test';
import { selectHomeSuggestions, type SuggestionContext } from '../components/reed/today/home-suggestions';

const morning: SuggestionContext = { hour: 9, weekday: 3, activeSession: false, trainedToday: false, activeDays: 0, targetDays: 4, hasTrainingHistory: false, hasGoal: false };
const ids = (context: SuggestionContext, seed: number) => selectHomeSuggestions(context, seed).map(item => item.id);

test('four distinct, varied starters stay stable with the same context and seed', () => {
  for (let seed = 0; seed < 150; seed++) {
    const picks = selectHomeSuggestions(morning, seed);
    assert.equal(picks.length, 4);
    assert.equal(new Set(picks.map(item => item.id)).size, 4);
    assert.ok(new Set(picks.map(item => item.intent)).size >= 3);
    assert.deepEqual(ids(morning, seed), picks.map(item => item.id));
    assert.ok(picks.every(item => item.label && item.icon && item.prompt));
  }
  assert.ok(new Set(Array.from({ length: 20 }, (_, seed) => ids(morning, seed).join(','))).size > 1);
});

test('randomness never introduces starters without the facts or time they need', () => {
  for (let seed = 0; seed < 150; seed++) {
    assert.ok(ids(morning, seed).every(id => !['week-review', 'check-progress', 'goal-check', 'workout-focus', 'wind-down'].includes(id)));
    const active = { ...morning, activeSession: true, hasTrainingHistory: true };
    assert.ok(ids(active, seed).every(id => !['plan-today', 'short-session', 'restart', 'balance-week', 'next-focus'].includes(id)));
    assert.ok(ids({ ...morning, trainedToday: true, activeDays: 1 }, seed).every(id => !['plan-today', 'short-session', 'restart'].includes(id)));
  }
});

test('activity and evening context materially favor recovery and wind-down', () => {
  const trained = { ...morning, trainedToday: true, activeDays: 4, hasTrainingHistory: true };
  const evening = { ...morning, hour: 21 };
  const occurrences = (context: SuggestionContext, id: string) => Array.from({ length: 300 }, (_, seed) => ids(context, seed).includes(id)).filter(Boolean).length;
  assert.ok(occurrences(trained, 'recovery') > occurrences(morning, 'recovery'));
  assert.ok(occurrences(evening, 'wind-down') > 100);
  assert.equal(occurrences(morning, 'wind-down'), 0);
});
