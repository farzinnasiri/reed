import assert from 'node:assert/strict';
import test from 'node:test';
import { isThinkingPrelude } from '../domains/reed/message-semantics';

test('a reply completed after twenty seconds is a reply, not a hidden thinking prelude', () => {
  assert.equal(isThinkingPrelude({ role: 'assistant', source: 'system', status: 'sent', createdAt: 1000, completedAt: 21000 }), false);
  assert.equal(isThinkingPrelude({ role: 'assistant', source: 'system', status: 'sent', createdAt: 1000, completedAt: 1000 }), true);
  assert.equal(isThinkingPrelude({ role: 'assistant', source: 'system', status: 'pending', createdAt: 1000 }), false);
});
