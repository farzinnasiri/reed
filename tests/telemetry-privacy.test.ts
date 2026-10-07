import assert from 'node:assert/strict';
import test from 'node:test';
import { safeExceptionType, safeOperationalAttrs, sanitizeExceptionCapture } from '../lib/telemetry-privacy';

test('automatic exceptions discard private messages, causes, stacks and extra properties', () => {
  const secret = 'private health text / image URI / token';
  const captured = sanitizeExceptionCapture({
    event: '$exception',
    properties: {
      $exception_list: [
        { value: secret, type: secret, cause: secret, stacktrace: { frames: [{ filename: secret }] } },
      ],
      prompt: secret,
      $current_url: secret,
      'exception.message': secret,
      $lib: 'posthog-react-native',
    },
  });
  assert.equal(JSON.stringify(captured).includes(secret), false);
  assert.equal(captured?.properties.$lib, 'posthog-react-native');
});

test('handled exceptions retain technical operation context and a stable slug', () => {
  const captured = sanitizeExceptionCapture({
    event: '$exception',
    properties: {
      'exception.slug': 'reed-message-send-failed',
      'event.name': 'reed.message_send',
      'attachment.count': 2,
      handled: true,
    },
  });
  assert.equal(captured?.properties['event.name'], 'reed.message_send');
  assert.equal(captured?.properties['attachment.count'], 2);
  assert.match(JSON.stringify(captured), /reed-message-send-failed/);
});

test('operational metadata rejects unknown fields and user-controlled Error.name', () => {
  assert.deepEqual(
    safeOperationalAttrs({
      duration_ms: 10,
      prompt: 'private',
      uri: 'private',
      'attachment.count': Infinity,
    }),
    { duration_ms: 10 },
  );
  const error = new Error('private');
  error.name = 'private';
  assert.equal(safeExceptionType(error), 'Error');
});

test('product analytics pass through unchanged', () => {
  const event = { event: 'workout_finished', properties: { exercise_count: 4 } };
  assert.equal(sanitizeExceptionCapture(event), event);
});
