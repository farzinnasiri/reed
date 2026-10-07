import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canReedReact,
  parseMessageReaction,
  reactionHistorySignal,
} from '../domains/reed/reactions';
import { parseReedChatResult } from '../convex/reedWidgets';
import { stopwatchSeconds } from '../domains/workout/stopwatch';
import { sessionDurationSeconds } from '../domains/workout/session-duration';

test('structured reactions validate independently of a usable reply and appear as speaker signals', () => {
  assert.equal(
    parseReedChatResult('{"response":"Good work.","reaction":"💪"}', 'fallback')
      .reaction,
    '💪',
  );
  assert.deepEqual(
    parseReedChatResult(
      '{"response":"Good work.","reaction":{"emoji":"💪"}}',
      'fallback',
    ),
    { response: 'Good work.' },
  );
  assert.equal(parseMessageReaction('🚀'), undefined);
  assert.equal(
    reactionHistorySignal({ role: 'assistant', reaction: '👎' }),
    ' [User reaction: 👎]',
  );
  assert.equal(
    reactionHistorySignal({ role: 'user', reaction: '💪' }),
    ' [Reed reaction: 💪]',
  );
  assert.equal(canReedReact([{ reaction: '💪' }, {}]), false);
  assert.equal(canReedReact([{ reaction: '💪' }, {}, {}]), true);
});

test('activity stopwatch includes foreground elapsed time and excludes paused time; total duration stays independent', () => {
  assert.equal(
    stopwatchSeconds({ accumulatedSeconds: 15, startedAt: 1000 }, 11000),
    25,
  );
  assert.equal(
    stopwatchSeconds({ accumulatedSeconds: 15, startedAt: null }, 999999),
    15,
  );
  assert.equal(
    stopwatchSeconds({ accumulatedSeconds: 15, startedAt: 1000 }, 0),
    15,
  );
  assert.equal(
    sessionDurationSeconds(
      { startedAt: 1000, endedAt: 61000, manualDurationSeconds: 1500 },
      999999,
    ),
    1500,
  );
  assert.equal(
    sessionDurationSeconds({ startedAt: 1000, endedAt: 61000 }, 999999),
    60,
  );
});
