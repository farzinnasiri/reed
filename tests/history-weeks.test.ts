import assert from 'node:assert/strict';
import test from 'node:test';
import { groupByWeek, weekDayLoads, weekStart } from '../components/workout/history-weeks';

const at = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour).getTime();

test('weeks start on Monday, so Sunday belongs to the week before', () => {
  assert.equal(weekStart(at(10, 7)), new Date(2026, 9, 5).getTime());
  assert.equal(weekStart(at(10, 11, 23)), new Date(2026, 9, 5).getTime());
  assert.equal(weekStart(at(10, 12, 0)), new Date(2026, 9, 12).getTime());
});

test('sessions are grouped by week and labelled for how long ago it was', () => {
  const now = at(10, 7);
  const groups = groupByWeek(
    [at(10, 7), at(10, 6), at(10, 1), at(9, 30), at(9, 23), at(9, 2)].map(startedAt => ({ startedAt })),
    now,
  );
  assert.deepEqual(groups.map(group => [group.label, group.items.length]), [
    ['This week', 2],
    ['Last week', 2],
    ['Sep 21–27', 1],
    ['Aug 31 – Sep 6', 1],
  ]);
});

test('a week\'s bars hold the sets of each day, Monday first', () => {
  const start = weekStart(at(10, 7));
  assert.deepEqual(
    weekDayLoads([{ startedAt: at(10, 5), sets: 9 }, { startedAt: at(10, 7), sets: 4 }, { startedAt: at(10, 7, 20), sets: 3 }, { startedAt: at(10, 11), sets: 1 }, { startedAt: at(10, 12), sets: 8 }], start),
    [9, 0, 7, 0, 0, 0, 1],
  );
});
