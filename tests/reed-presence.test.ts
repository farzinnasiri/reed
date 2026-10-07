import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveReedPresence } from '../components/reed/presence/presence-state';
import { computeMascotFrame, createMascotRuntime, getMascotNextFrameDelay, mascotTransformMatrix, setMascotExpression, type MascotExpression } from '../components/reed/mascot/mascot-engine';

function glyphOpacities(frame: ReturnType<typeof computeMascotFrame>) {
  return [Math.max(frame.main.opacity, frame.second.opacity), frame.ring.opacity,
    Math.max(frame.meter.opacity, frame.track.opacity), frame.focus.opacity,
    frame.bars.opacity, frame.typing.opacity, frame.wave.opacity, frame.dizzy.opacity];
}

test('the line clears before the thinking ring appears', () => {
  const runtime = createMascotRuntime('idle', 10000);
  setMascotExpression(runtime, 'thinking', 10000, false);
  for (let elapsed = 0; elapsed <= 460; elapsed += 10) {
    const frame = computeMascotFrame(runtime, 10000 + elapsed, false);
    assert.ok(frame.main.opacity === 0 || frame.ring.opacity === 0, `overlap at ${elapsed}ms`);
  }
});

test('all expression handoffs, including entry effects and blinks, show at most one glyph family', () => {
  const names: MascotExpression[] = ['dizzy', 'idle', 'listening', 'speaking', 'typing', 'watching',
    'thinking', 'focused', 'encouraging', 'concerned', 'happy', 'excited', 'proud', 'surprised',
    'sad', 'relieved', 'exhausted', 'ready', 'rest', 'setComplete', 'personalRecord', 'missed', 'recovery',
    'wink', 'effort', 'sleepy', 'curious'];
  for (const from of names) for (const to of names) {
    const runtime = createMascotRuntime(from, 10000);
    setMascotExpression(runtime, to, 10000, false);
    for (let elapsed = 0; elapsed <= 1800; elapsed += 10) {
      const frame = computeMascotFrame(runtime, 10000 + elapsed, false);
      assert.ok(glyphOpacities(frame).filter(opacity => opacity > 1e-8).length <= 1,
        `${from} -> ${to} overlap at ${elapsed}ms`);
    }
    runtime.nextBlinkAt = 12000;
    for (let elapsed = 2000; elapsed <= 2300; elapsed += 10) {
      assert.ok(glyphOpacities(computeMascotFrame(runtime, 10000 + elapsed, false))
        .filter(opacity => opacity > 1e-8).length <= 1, `${to} blink overlap at ${elapsed}ms`);
    }
  }
});

test('interrupting glyph handoffs preserves their visible opacity', () => {
  for (const elapsed of [100, 200, 300, 400]) {
    const runtime = createMascotRuntime('idle', 10000);
    setMascotExpression(runtime, 'thinking', 10000, false);
    const before = computeMascotFrame(runtime, 10000 + elapsed, false);
    setMascotExpression(runtime, 'focused', 10000 + elapsed, false);
    const after = computeMascotFrame(runtime, 10000 + elapsed, false);
    assert.deepEqual(glyphOpacities(after), glyphOpacities(before));
    for (let offset = 10; offset <= 460; offset += 10) {
      assert.ok(glyphOpacities(computeMascotFrame(runtime, 10000 + elapsed + offset, false))
        .filter(opacity => opacity > 1e-8).length <= 1);
    }
  }
});

const resting = {
  beat: null,
  draftLevel: 'none',
  hasActiveSession: false,
  hasError: false,
  isComposerFocused: false,
  isPreparingAttachments: false,
  isReplyPending: false,
  voiceStatus: 'idle',
} as const;

test('drafting during a pending reply keeps Reed thinking, then follows the draft when it completes', () => {
  const composing = { ...resting, draftLevel: 'long' as const, isComposerFocused: true };
  assert.equal(deriveReedPresence({ ...composing, isReplyPending: true }), 'thinking');
  assert.equal(deriveReedPresence(composing), 'following');
});

test('recording and transcription override focus, draft and temporary reply acknowledgements', () => {
  const composing = { ...resting, beat: 'speaking' as const, draftLevel: 'long' as const, isComposerFocused: true };
  assert.equal(deriveReedPresence({ ...composing, voiceStatus: 'listening' }), 'listening');
  assert.equal(deriveReedPresence({ ...composing, voiceStatus: 'transcribing' }), 'thinking');
});

test('the received beat can coexist with a saved pending turn, but a stale speaking beat cannot hide it', () => {
  assert.equal(deriveReedPresence({ ...resting, beat: 'received', isReplyPending: true }), 'received');
  assert.equal(deriveReedPresence({ ...resting, beat: 'speaking', isReplyPending: true }), 'thinking');
});

test('failed operations stay concerned, while successful retry can become pending', () => {
  assert.equal(deriveReedPresence({ ...resting, hasError: true, isComposerFocused: true }), 'concerned');
  assert.equal(deriveReedPresence({ ...resting, hasError: true, isReplyPending: true }), 'thinking');
  assert.equal(deriveReedPresence({ ...resting, voiceStatus: 'failed' }), 'concerned');
});

test('suggestion acknowledgement gives way to a new draft and eventually rests', () => {
  assert.equal(deriveReedPresence({ ...resting, beat: 'waitingOnYou' }), 'waitingOnYou');
  assert.equal(deriveReedPresence({ ...resting, beat: 'waitingOnYou', draftLevel: 'short' }), 'following');
  assert.equal(deriveReedPresence(resting), 'resting');
});

test('retargeting an expression keeps the currently drawn pose, including an interrupted gesture', () => {
  const runtime = createMascotRuntime('idle', 10000);
  setMascotExpression(runtime, 'happy', 10100, false);
  const before = computeMascotFrame(runtime, 10260, false);
  setMascotExpression(runtime, 'thinking', 10260, false);
  const after = computeMascotFrame(runtime, 10260, false);
  assert.deepEqual(after.coreMatrix, before.coreMatrix);
  assert.equal(after.aperture, before.aperture);
});

test('reduced motion stops breathing and the thinking spinner while preserving the readable ring', () => {
  const runtime = createMascotRuntime('thinking', 10000);
  const before = computeMascotFrame(runtime, 11000, true);
  const after = computeMascotFrame(runtime, 15000, true);
  assert.deepEqual(after.coreMatrix, before.coreMatrix);
  assert.deepEqual(after.ring, before.ring);
  assert.equal(after.ring.opacity, 1);
  assert.equal(getMascotNextFrameDelay(runtime, 15000, true, true), Infinity);
});

test('reduced motion preserves an idle blink without restarting a body transition', () => {
  const runtime = createMascotRuntime('idle', 10000);
  runtime.nextBlinkAt = 11000;
  const open = computeMascotFrame(runtime, 10999, true);
  computeMascotFrame(runtime, 11000, true);
  const closed = computeMascotFrame(runtime, 11110, true);
  assert.notEqual(closed.aperture, open.aperture);
  assert.deepEqual(closed.coreMatrix, open.coreMatrix);
});

test('semantic gaze remains bounded even for an out-of-range target', () => {
  const runtime = createMascotRuntime('idle', 10000);
  const frame = computeMascotFrame(runtime, 10000, true, 1, { x: 100, y: -100 });
  assert.ok(Math.abs(frame.apertureMatrix[4] - 4.8) < 1e-10);
  assert.ok(Math.abs(frame.apertureMatrix[5] + 3.3) < 1e-10);
});

test('native affine matrices rotate and scale about the same SVG origin as web transforms', () => {
  const [a, b, c, d, x, y] = mascotTransformMatrix(7, 9, 90, 2, 3);
  assert.ok(Math.abs(a) < 1e-10);
  assert.equal(b, 2);
  assert.equal(c, -3);
  assert.ok(Math.abs(d) < 1e-10);
  assert.equal(x, 7);
  assert.equal(y, 9);
});

test('resting expressions center their glyph while semantic gaze still follows input', () => {
  for (const name of ['idle', 'listening', 'speaking', 'watching', 'thinking', 'happy', 'proud', 'typing'] as const) {
    const frame = computeMascotFrame(createMascotRuntime(name, 1000), 5000, true);
    assert.equal(frame.apertureMatrix[4], 0, `${name} lateral offset`);
  }
  const followed = computeMascotFrame(createMascotRuntime('idle', 1000), 5000, true, 1, { x: 1, y: 0 });
  assert.ok(Math.abs(followed.apertureMatrix[4] - 4.8) < 1e-10);
});

test('uneven and folded eyes stay centered horizontally', () => {
  for (const name of ['concerned', 'wink', 'curious', 'effort', 'personalRecord', 'ready'] as const) {
    const frame = computeMascotFrame(createMascotRuntime(name, 1000), 5000, true);
    const xs: number[] = [];
    for (const stroke of [frame.main, frame.second]) {
      const n = stroke.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      // M x y Q cx cy x y Q cx cy x y. Sample both exact quadratic segments.
      for (const [a, b, c] of [[n[0], n[2], n[4]], [n[4], n[6], n[8]]]) {
        for (let i = 0; i <= 100; i++) { const t = i / 100; xs.push((1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c); }
      }
    }
    assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2) < .02, name);
  }
});

test('folded eyes point toward each other', () => {
  const frame = computeMascotFrame(createMascotRuntime('effort', 1000), 5000, true);
  const [left, right] = [frame.main, frame.second].map(stroke => stroke.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number));
  // The middle point of each eye sits nearer the center than its ends: "> <".
  assert.ok(left[4] > left[0] && left[4] > left[8]);
  assert.ok(right[4] < right[0] && right[4] < right[8]);
});

test('accents only show for the expressions that carry them, and fade in with the pose', () => {
  const visible = (name: MascotExpression) => computeMascotFrame(createMascotRuntime(name, 1000), 5000, false).accents
    .filter(accent => accent.opacity > 0.01).length;
  // Celebrating faces carry no decoration: they stay serious.
  for (const name of ['idle', 'listening', 'thinking', 'concerned', 'happy', 'focused', 'personalRecord', 'excited', 'setComplete'] as const) assert.equal(visible(name), 0, name);
  assert.ok(visible('sleepy') >= 1);
  assert.equal(visible('effort'), 1);
  const runtime = createMascotRuntime('idle', 10000);
  setMascotExpression(runtime, 'effort', 10000, false);
  const early = computeMascotFrame(runtime, 10050, false).accents[2].opacity;
  const settled = computeMascotFrame(runtime, 11000, false).accents[2].opacity;
  assert.ok(early < settled && settled === 1);
});

test('transition length and speed are controllable', () => {
  const opacityAt = (transitionMs: number, elapsed: number) => {
    const runtime = createMascotRuntime('idle', 10000);
    setMascotExpression(runtime, 'effort', 10000, false, transitionMs);
    return computeMascotFrame(runtime, 10000 + elapsed, false).accents[2].opacity;
  };
  // Instant snaps straight to the pose; slow is still arriving when smooth has landed.
  assert.equal(opacityAt(0, 0), 1);
  assert.ok(opacityAt(900, 460) < opacityAt(460, 460));
  assert.equal(opacityAt(900, 900), 1);

  // Twice the speed plays an entry action in half the time.
  const lift = (speed: number, elapsed: number) => {
    const runtime = createMascotRuntime('idle', 10000);
    runtime.speed = speed;
    setMascotExpression(runtime, 'excited', 10000, false, 0);
    // The leap's squash-and-stretch is driven by time since the expression began.
    return computeMascotFrame(runtime, 10000 + elapsed, false).coreMatrix[0];
  };
  assert.ok(Math.abs(lift(2, 35) - lift(1, 70)) < 1e-9);
  assert.ok(Math.abs(lift(2, 35) - lift(1, 35)) > 1e-4);

  // Speed also scales breathing.
  const breath = (speed: number) => {
    const runtime = createMascotRuntime('idle', 10000);
    runtime.nextBlinkAt = Infinity;
    runtime.speed = speed;
    return computeMascotFrame(runtime, 11000, false).coreMatrix[5];
  };
  assert.notEqual(breath(1), breath(2));
});

test('listening keeps two equally sized upright eyes centered throughout its settled cycle', () => {
  for (const reduced of [false, true]) {
    const runtime = createMascotRuntime('listening', 1000);
    runtime.nextBlinkAt = Infinity;
    for (const at of [1000, 1600, 2400, 5000]) {
      const frame = computeMascotFrame(runtime, at, reduced);
      const left = frame.main.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const right = frame.second.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      assert.equal(frame.main.opacity, 1); assert.equal(frame.second.opacity, 1);
      assert.equal(frame.main.width, frame.second.width);
      assert.equal(left[0], left[8]); assert.equal(right[0], right[8]);
      assert.equal(left[0] + right[0], 0);
      assert.deepEqual(left.filter((_, index) => index % 2 === 1), right.filter((_, index) => index % 2 === 1));
      assert.equal(frame.coreMatrix[1], 0); assert.equal(frame.apertureMatrix[4], 0);
    }
  }
});
