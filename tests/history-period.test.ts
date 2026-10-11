import assert from 'node:assert/strict';
import test from 'node:test';
import { historyPeriodRange } from '../components/workout/history-period';

const at = (month: number, day: number, hour = 12) =>
  new Date(2026, month - 1, day, hour).getTime();

test('the default week uses Monday through Sunday, with an exclusive next-Monday boundary', () => {
  const range = historyPeriodRange('week', at(10, 8));
  assert.equal(range.since, at(10, 5, 0));
  assert.equal(range.before, at(10, 12, 0));
  assert.match(range.label, /Mon, Oct 5.*Sun, Oct 11/);
  assert.equal(historyPeriodRange('week', at(10, 11, 23)).since, range.since);
  assert.equal(historyPeriodRange('week', at(10, 12, 0)).since, range.before);
});

test('30 days includes all of today and 29 preceding calendar days', () => {
  const range = historyPeriodRange('month', at(10, 8, 21));
  assert.equal(range.since, at(9, 9, 0));
  assert.equal(range.before, at(10, 9, 0));
  const all = historyPeriodRange('all', at(10, 8));
  assert.equal(all.since, undefined);
  assert.equal(all.before, range.before);
});
