import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseReedChatResult, sanitizeReedPresentation, sanitizeReedReplies, sanitizeReedWidget,
} from '../convex/reedWidgets';

const facts = {
  profileId: 'viewer', session: { _id: 'session', profileId: 'viewer', status: 'ended' },
  enabledPresetKeys: ['walk', 'cycle', 'mobility', 'stretching', 'run', 'pull_ups', 'push_ups'],
};

test('session widget requires an existing, owned, ended session', () => {
  const widget = { kind: 'session_summary', sessionId: 'session' };
  assert.deepEqual(sanitizeReedWidget(widget, facts), widget);
  assert.equal(sanitizeReedWidget(widget, { ...facts, session: null }), undefined);
  assert.equal(sanitizeReedWidget(widget, { ...facts, session: { ...facts.session, profileId: 'other' } }), undefined);
  assert.equal(sanitizeReedWidget(widget, { ...facts, session: { ...facts.session, status: 'active' } }), undefined);
  assert.equal(sanitizeReedWidget({ ...widget, sessionId: 'other' }, facts), undefined);
  assert.equal(sanitizeReedWidget({ kind: 'session_summary', sessionId: 42 }, facts), undefined);
});

test('quick-log widgets retain enabled keys, dedupe and cap at six after filtering', () => {
  assert.deepEqual(sanitizeReedWidget({ kind: 'quick_log', presetKeys: [
    'disabled', 2, 'walk', 'walk', 'cycle', 'mobility', 'stretching', 'run', 'pull_ups', 'push_ups',
  ] }, facts), { kind: 'quick_log', presetKeys: ['walk', 'cycle', 'mobility', 'stretching', 'run', 'pull_ups'] });
  for (const presetKeys of [[], ['disabled'], null, 'walk']) {
    assert.equal(sanitizeReedWidget({ kind: 'quick_log', presetKeys }, facts), undefined);
  }
  assert.equal(sanitizeReedWidget({ kind: 'quick_log', presetKeys: ['walk'] }, { ...facts, enabledPresetKeys: [] }), undefined);
});

test('widget catalog strips copied data and rejects unsupported kinds or multiple widgets', () => {
  assert.deepEqual(sanitizeReedWidget({ kind: 'weigh_in', lastKg: 85, style: 'blue' }, facts), { kind: 'weigh_in' });
  for (const value of [undefined, null, 'weigh_in', {}, { kind: 'plan' }, [{ kind: 'weigh_in' }]]) {
    assert.equal(sanitizeReedWidget(value, facts), undefined);
  }
});

test('reply chips trim, drop invalid/long items, dedupe case-insensitively and cap at three', () => {
  assert.deepEqual(sanitizeReedReplies([' ', null, ' Yes ', 'YES', 'a'.repeat(25), 'No', 'Later', 'Never']), ['Yes', 'No', 'Later']);
  assert.deepEqual(sanitizeReedReplies(['a'.repeat(24)]), ['a'.repeat(24)]);
  assert.equal(sanitizeReedReplies(['🙂', 'Log 🙂']), undefined);
  assert.deepEqual(sanitizeReedReplies(['Later.', 'LATER!', 'Plan Friday?', 'Log weight…']), ['Later', 'Plan Friday?', 'Log weight']);
  for (const value of [undefined, null, 'Yes', [], [' ', 'a'.repeat(25)]]) {
    assert.equal(sanitizeReedReplies(value), undefined);
  }
});

test('useful reply chips can follow statements and never change reply text', () => {
  const response = 'Do you want to focus on strength?';
  const value = { widget: { kind: 'session_summary', sessionId: 'foreign' }, replies: [' Yes ', 'No'] };
  assert.deepEqual(sanitizeReedPresentation(value, facts, response), { replies: ['Yes', 'No'] });
  assert.deepEqual(sanitizeReedPresentation(value, facts, 'Focus on strength.'), { replies: ['Yes', 'No'] });
  assert.deepEqual(sanitizeReedPresentation({ widget: { kind: 'weigh_in' }, replies: ['Yes'] }, facts, 'Ready？'), {
    widget: { kind: 'weigh_in' }, replies: ['Yes'],
  });
});

test('model envelope preserves the same response with optional presentation', () => {
  const response = 'Your session is ready.\nWould you like recovery next?';
  const parsed = parseReedChatResult(JSON.stringify({ response, widget: { kind: 'session_summary', sessionId: 'session' }, replies: ['Yes', 'No'] }), 'fallback');
  assert.equal(parsed.response, response);
  assert.deepEqual(sanitizeReedPresentation(parsed, facts, parsed.response), {
    widget: { kind: 'session_summary', sessionId: 'session' }, replies: ['Yes', 'No'],
  });
  assert.deepEqual(parseReedChatResult('{"response":"Old message"}', 'fallback'), { response: 'Old message' });
  assert.deepEqual(parseReedChatResult('```json\n{"response":"Fenced reply"}\n```', 'fallback'), { response: 'Fenced reply' });
  assert.deepEqual(parseReedChatResult('Plain text reply', 'fallback'), { response: 'Plain text reply' });
});

test('malformed model metadata recovers existing text and drops all optional output', () => {
  assert.deepEqual(parseReedChatResult('{"response":"Still a useful reply", "widget":BROKEN}', 'fallback'), { response: 'Still a useful reply' });
  assert.deepEqual(parseReedChatResult('{"response":"He said \\"yes\\".\\nReady?", "replies":[', 'fallback'), { response: 'He said "yes".\nReady?' });
  for (const text of ['', '{"response":42,"widget":{"kind":"weigh_in"}}', '{"widget":BROKEN}', '[]', '{"response":" "}']) {
    assert.deepEqual(parseReedChatResult(text, 'fallback'), { response: 'fallback' });
  }
  const parsed = parseReedChatResult('{"response":"A useful reply?","widget":{"kind":"unsupported"},"replies":"invalid"}', 'fallback');
  assert.equal(parsed.response, 'A useful reply?');
  assert.deepEqual(sanitizeReedPresentation(parsed, facts, parsed.response), {});
});
