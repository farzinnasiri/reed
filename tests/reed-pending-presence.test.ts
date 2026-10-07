import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { platformModule } from './helpers/platform-module';

test('pending copy and glyphs rotate, pause when hidden, and stop immediately on completion', async (t) => {
  const dom = new JSDOM('<div id="root"></div>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const { usePendingPresence, REED_THINKING_LINES, REED_RECOVERY_LINES, thinkingLineForStep } = platformModule<
    typeof import('../components/reed/presence/use-pending-presence')
  >('components/reed/presence/use-pending-presence.ts', {
    '@/design/motion': { reedMotion: { presence: { hintDelayMs: 400, thinkingStepMs: 4800 } } },
  });
  let input = { active: true, pending: true, recovering: false, transcribing: false, varyGlyphs: true };
  let output!: ReturnType<typeof usePendingPresence>;
  function Waiting() { output = usePendingPresence(input); return null; }
  const root = createRoot(document.getElementById('root')!);
  const render = async () => act(async () => root.render(createElement(Waiting)));
  const advance = async (ms: number) => act(async () => t.mock.timers.tick(ms));
  await render();
  assert.equal(output.hint, null);
  await advance(399);
  assert.equal(output.hint, null);
  await advance(1);
  assert.equal(output.hint, 'Thinking');
  assert.equal(output.expression, 'thinking');
  await advance(4800);
  assert.notEqual(output.hint, 'Thinking');
  assert.equal(output.expression, 'focused');
  const firstVariation = output.hint;
  await advance(4800);
  assert.notEqual(output.hint, firstVariation);
  assert.equal(output.expression, 'thinking');
  await advance(4800);
  assert.equal(output.expression, 'typing');
  await advance(200);
  input = { ...input, active: false };
  await render();
  assert.equal(output.hint, null);
  await advance(10000);
  assert.equal(output.hint, null);
  input = { ...input, active: true, varyGlyphs: false };
  await render();
  assert.equal('detail' in output, false, 'long waits do not add an elapsed-time line');
  assert.ok(output.hint);
  assert.equal(output.expression, 'thinking');
  input = { ...input, pending: false };
  await render();
  assert.equal(output.hint, null);
  await advance(5000);
  input = { ...input, pending: true };
  await render();
  assert.equal(output.hint, null);
  await advance(400);
  assert.equal(output.hint, 'Thinking');
  input = { ...input, recovering: true };
  await render();
  assert.ok(REED_RECOVERY_LINES.includes(output.hint as typeof REED_RECOVERY_LINES[number]), 'a reported failure shows recovery copy immediately');
  const recoveryFirst = output.hint;
  await advance(4800);
  assert.notEqual(output.hint, recoveryFirst);
  assert.ok(REED_RECOVERY_LINES.includes(output.hint as typeof REED_RECOVERY_LINES[number]));
  input = { ...input, pending: false, recovering: false };
  await render();
  assert.equal(output.hint, null, 'completion immediately clears recovery copy');
  input = { ...input, pending: true };
  await render();
  await advance(400);
  assert.equal(output.hint, 'Thinking', 'the next turn returns to normal thinking copy');
  input = { ...input, pending: false, transcribing: true };
  await render();
  await advance(400);
  assert.equal(output.hint, 'Transcribing');
  await advance(4800);
  assert.equal(output.hint, 'Transcribing');
  assert.equal(output.expression, 'thinking');
  assert.equal(REED_THINKING_LINES.length, 20);
  // Every authored line is reachable without repeats before the list loops, for any starting point.
  for (let offset = 0; offset < 19; offset++) {
    const cycle = Array.from({ length: 19 }, (_, i) => thinkingLineForStep(i + 1, offset));
    assert.equal(new Set(cycle).size, 19);
  }
  await act(async () => root.unmount());
});
