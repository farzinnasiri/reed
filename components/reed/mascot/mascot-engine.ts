// Frame engine for Reed's mascot. This is the source of truth for every expression; browse them with
// `npm run mascot:sheet`. Worklet-safe geometry: callers own the clock, gaze and frame scheduling.

type BlinkMode = 'closed' | 'heavy' | 'line' | 'none' | 'pair' | 'ring' | 'vertical';
type MascotAction =
  | 'attend' | 'complete' | 'drop' | 'lift' | 'nod' | 'open' | 'record' | 'release'
  | 'rise' | 'set' | 'settle' | 'shortfall' | 'sink' | 'success';

const numericDefaults = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  angle: 0,
  apertureWidth: 45,
  apertureCurve: 0,
  apertureFold: 0,
  foldBias: 0,
  apertureAngle: 0,
  apertureY: 0,
  apertureThickness: 8,
  apertureOpacity: 1,
  split: 0,
  eyeGap: 12,
  eyeRotation: 0,
  eyeSplay: 0,
  eyeLengthBalance: 0,
  eyeOffsetY: 0,
  eyeCurveBalance: 0,
  /** Bends upright eyes toward each other: positive draws "> <", negative "< >". */
  eyeFold: 0,
  ring: 0,
  ringRadius: 16,
  spinner: 0,
  dizzy: 0,
  meter: 0,
  meterProgress: 0,
  scan: 0,
  focusReticle: 0,
  soundBars: 0,
  typingDots: 0,
  breathWave: 0,
  // Small accents beside the face, faded in like any other pose value.
  snooze: 0,
  sweat: 0,
  gazeX: 0,
  gazeY: 0,
  haloEnergy: 0.58,
  breathAmplitude: 1,
  breathPeriod: 5,
  blinkPeriod: 4.5,
  blinkDuration: 0.22,
  blinkJitter: 0.9,
};

type NumericPose = typeof numericDefaults;
type NumericKey = keyof NumericPose;

type Expression = NumericPose & {
  action?: MascotAction;
  actionDuration: number;
  actionHeight: number;
  blinkMode: BlinkMode;
  entryBlink: 'double' | 'none';
  label: string;
};

const numericKeys = Object.keys(numericDefaults) as NumericKey[];

function expression(values: Partial<Expression> & { label: string }): Expression {
  'worklet';
  return {
    ...numericDefaults,
    actionDuration: 0,
    actionHeight: 0,
    blinkMode: 'line',
    entryBlink: 'none',
    ...values,
  };
}

const expressions = {
  dizzy: expression({ label: 'Dizzy', dizzy: 1, apertureOpacity: 0, breathAmplitude: 0.3, blinkPeriod: 0, blinkMode: 'none' }),
  idle: expression({
    label: 'Neutral',
    apertureThickness: 5.5,
    breathAmplitude: 2.2, breathPeriod: 4.8, blinkPeriod: 3.7,
  }),
  listening: expression({
    label: 'Listening',
    apertureWidth: 50, apertureThickness: 6.5,
    split: 1, eyeGap: 20, eyeRotation: 90,
    breathAmplitude: 0.7, breathPeriod: 5.2, blinkPeriod: 5.2,
    blinkMode: 'vertical',
    action: 'attend', actionDuration: 0.38,
  }),
  speaking: expression({
    label: 'Speaking',
    x: 3, y: -2, angle: 2,
    apertureWidth: 58, apertureThickness: 5.5, apertureOpacity: 0,
    soundBars: 1,
    haloEnergy: 0.62,
    breathAmplitude: 0.45, breathPeriod: 5, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'lift', actionHeight: 4, actionDuration: 0.34,
  }),
  typing: expression({
    label: 'Typing',
    x: 1, y: -1,
    apertureWidth: 54, apertureThickness: 5.5, apertureOpacity: 0,
    typingDots: 1,
    breathAmplitude: 0.35, breathPeriod: 5.4, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'settle', actionDuration: 0.32,
  }),
  watching: expression({
    label: 'Observing',
    x: 2, y: -5, angle: 1,
    apertureWidth: 38, apertureThickness: 6,
    ring: 1, ringRadius: 13,
    breathAmplitude: 0.35, breathPeriod: 5.6, blinkPeriod: 5.6,
    blinkDuration: 0.26, blinkMode: 'ring',
  }),
  thinking: expression({
    label: 'Thinking',
    x: -2, y: -6, scaleX: 0.99, scaleY: 1.01,
    apertureWidth: 40, apertureThickness: 6.5,
    ring: 1, ringRadius: 16, spinner: 1,
    gazeY: -2,
    breathAmplitude: 0.45, breathPeriod: 5.8, blinkPeriod: 0,
    blinkMode: 'none',
  }),
  focused: expression({
    label: 'Focused',
    y: -1, scaleX: 1.01, scaleY: 0.99,
    apertureWidth: 42, apertureY: 8, apertureThickness: 7.5,
    split: 1, eyeGap: 20, eyeRotation: 90,
    gazeY: 3.5,
    breathAmplitude: 0.25, breathPeriod: 6, blinkPeriod: 6,
    blinkMode: 'vertical',
    action: 'settle', actionDuration: 0.36,
  }),
  encouraging: expression({
    label: 'Encouraging',
    x: 2, y: -6, angle: 5,
    apertureWidth: 58, apertureCurve: -5, apertureThickness: 7,
    split: 1, eyeGap: 18,
    haloEnergy: 0.63,
    breathAmplitude: 0.5, breathPeriod: 5.2, blinkPeriod: 5.4,
    blinkMode: 'closed',
    action: 'nod', actionDuration: 0.44,
  }),
  concerned: expression({
    label: 'Concerned',
    x: -1, y: 4, angle: -2,
    apertureWidth: 56, apertureCurve: -1.5, apertureThickness: 6.5,
    split: 1, eyeGap: 18, eyeSplay: -17,
    breathAmplitude: 0.35, breathPeriod: 6, blinkPeriod: 5.4,
    blinkDuration: 0.32, blinkMode: 'pair',
    action: 'settle', actionDuration: 0.42,
  }),
  happy: expression({
    label: 'Pleased',
    y: -5, scaleX: 1.01, scaleY: 1.01,
    apertureWidth: 64, apertureCurve: -8, apertureThickness: 8,
    split: 1, eyeGap: 14,
    breathAmplitude: 0.65, breathPeriod: 4.6, blinkPeriod: 5,
    blinkMode: 'closed',
    action: 'lift', actionHeight: 8, actionDuration: 0.48,
  }),
  excited: expression({
    label: 'Excited',
    y: -10, scaleX: 0.99, scaleY: 1.02,
    apertureWidth: 74, apertureThickness: 8.5,
    split: 1, eyeGap: 26, eyeRotation: 90, eyeSplay: -12,
    haloEnergy: 0.7,
    breathAmplitude: 0.3, breathPeriod: 4.4, blinkPeriod: 4.7,
    blinkMode: 'vertical',
    action: 'success', actionHeight: 26, actionDuration: 0.68,
  }),
  proud: expression({
    label: 'Proud',
    y: -12, scaleX: 1.02, scaleY: 1.015, angle: -3,
    apertureWidth: 60, apertureCurve: 4.5, apertureThickness: 7,
    split: 1, eyeGap: 16,
    gazeY: -2, haloEnergy: 0.64,
    breathAmplitude: 0.35, breathPeriod: 5.8, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'rise', actionDuration: 0.5,
  }),
  surprised: expression({
    label: 'Surprised',
    y: -8, scaleX: 1.01, scaleY: 1.015,
    apertureWidth: 48, apertureThickness: 8.5,
    ring: 1, ringRadius: 21,
    haloEnergy: 0.68,
    breathAmplitude: 0.16, breathPeriod: 5.8, blinkPeriod: 5.2,
    blinkDuration: 0.28, blinkMode: 'ring',
    action: 'open', actionDuration: 0.38,
  }),
  sad: expression({
    label: 'Empathetic',
    y: 16, scaleX: 1.02, scaleY: 0.98, angle: -3,
    apertureWidth: 52, apertureCurve: -3, apertureThickness: 6,
    split: 1, eyeGap: 18, eyeSplay: -11, eyeOffsetY: 0,
    gazeY: 2,
    breathAmplitude: 0.35, breathPeriod: 6.6, blinkPeriod: 5.8,
    blinkDuration: 0.36, blinkMode: 'heavy',
    action: 'drop', actionDuration: 0.48,
  }),
  relieved: expression({
    label: 'Relieved',
    y: 18, scaleX: 1.01, scaleY: 0.99,
    apertureWidth: 66, apertureCurve: -5, apertureY: 4, apertureThickness: 5.5,
    split: 1, eyeGap: 16,
    breathAmplitude: 1, breathPeriod: 6.4, blinkPeriod: 6.2,
    blinkMode: 'closed',
    action: 'release', actionDuration: 0.7,
  }),
  exhausted: expression({
    label: 'Weary',
    y: 30, scaleX: 1.03, scaleY: 0.97, angle: -2,
    apertureWidth: 52, apertureCurve: 1.5, apertureY: 6, apertureThickness: 4.5,
    split: 1, eyeGap: 16, eyeSplay: -7,
    sweat: 1,
    breathAmplitude: 1.4, breathPeriod: 7.4, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'sink', actionDuration: 1.05,
  }),
  ready: expression({
    label: 'Determined',
    y: -4, scaleX: 1.01, scaleY: 1.01,
    apertureWidth: 54, apertureThickness: 8.5,
    split: 1, eyeGap: 16, eyeSplay: 17,
    haloEnergy: 0.6,
    breathAmplitude: 0.12, breathPeriod: 6, blinkPeriod: 5.2,
    blinkMode: 'pair',
    action: 'set', actionDuration: 0.42,
  }),
  rest: expression({
    label: 'Waiting',
    y: 38, scaleX: 1.015, scaleY: 0.985,
    apertureWidth: 70, apertureY: 4, apertureThickness: 6,
    apertureOpacity: 0, meter: 1, meterProgress: 0.08,
    breathAmplitude: 1.4, breathPeriod: 6.4, blinkPeriod: 0,
    blinkMode: 'none',
  }),
  setComplete: expression({
    label: 'Affirming',
    y: -9, scaleX: 0.99, scaleY: 1.01,
    apertureWidth: 68, apertureCurve: -8,
    split: 1, eyeGap: 19,
    haloEnergy: 0.67,
    breathAmplitude: 0.35, breathPeriod: 5.2, blinkPeriod: 5.1,
    blinkMode: 'closed',
    action: 'complete', actionHeight: 22, actionDuration: 0.72,
  }),
  personalRecord: expression({
    label: 'Celebrating',
    y: -15, scaleX: 0.985, scaleY: 1.02,
    apertureWidth: 60, apertureThickness: 8,
    split: 1, eyeGap: 22, eyeRotation: 90, eyeFold: 6,
    haloEnergy: 0.78,
    breathAmplitude: 0.3, breathPeriod: 5.2, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'record', actionHeight: 34, actionDuration: 0.82,
  }),
  missed: expression({
    label: 'Reassuring',
    y: 23, scaleX: 1.02, scaleY: 0.98,
    apertureWidth: 74, apertureY: 5, apertureThickness: 5.5,
    apertureOpacity: 0, meter: 1, meterProgress: 0.82,
    breathAmplitude: 0.2, breathPeriod: 6.2, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'shortfall', actionDuration: 0.64,
  }),
  recovery: expression({
    label: 'Restoring',
    y: 31, scaleX: 1.015, scaleY: 0.99,
    apertureWidth: 72, apertureY: 7, apertureThickness: 4,
    apertureOpacity: 0, breathWave: 1,
    breathAmplitude: 1.1, breathPeriod: 7, blinkPeriod: 0,
    blinkMode: 'none',
  }),
  wink: expression({
    label: 'Winking',
    x: 2, y: -6, angle: 6,
    apertureWidth: 54, apertureCurve: -3.5, apertureThickness: 7.5,
    split: 1, eyeGap: 18, eyeRotation: 45, eyeSplay: -45, eyeCurveBalance: -3.5, eyeLengthBalance: 0.04, eyeOffsetY: -2.5,
    breathAmplitude: 0.5, breathPeriod: 5, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'nod', actionDuration: 0.44,
  }),
  effort: expression({
    label: 'Straining',
    y: 2, scaleX: 1.04, scaleY: 0.96,
    apertureWidth: 56, apertureThickness: 7.5,
    split: 1, eyeGap: 20, eyeRotation: 90, eyeFold: 6.5,
    sweat: 1,
    breathAmplitude: 0.6, breathPeriod: 2.2, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'set', actionDuration: 0.42,
  }),
  sleepy: expression({
    label: 'Sleepy',
    y: 20, scaleX: 1.02, scaleY: 0.98, angle: -4,
    apertureWidth: 50, apertureCurve: 2, apertureY: 4, apertureThickness: 4.5,
    split: 1, eyeGap: 16,
    snooze: 1,
    breathAmplitude: 1.6, breathPeriod: 7.8, blinkPeriod: 0,
    blinkMode: 'none',
    action: 'sink', actionDuration: 1.05,
  }),
  curious: expression({
    label: 'Curious',
    x: 3, y: -4, angle: 9,
    apertureWidth: 50, apertureThickness: 7.5,
    split: 1, eyeGap: 20, eyeRotation: 90, eyeLengthBalance: -0.22, eyeOffsetY: 1.5,
    gazeX: 2, gazeY: -1,
    breathAmplitude: 0.45, breathPeriod: 5.2, blinkPeriod: 4.6,
    blinkMode: 'vertical', entryBlink: 'double',
    action: 'attend', actionDuration: 0.38,
  }),
} satisfies Record<string, Expression>;

export type MascotExpression = keyof typeof expressions;

/** Every expression, in the order they are defined. */
export const MASCOT_EXPRESSIONS = Object.keys(expressions) as MascotExpression[];

export function getMascotExpressionLabel(name: MascotExpression) {
  'worklet';
  return expressions[name].label;
}

// States whose glyphs keep moving after the entry transition settles.
const continuousExpressions: MascotExpression[] = [
  'dizzy', 'recovery', 'rest', 'speaking', 'thinking', 'typing', 'watching',
];

/** How long moving from one expression to the next takes unless the caller says otherwise. */
export const MASCOT_TRANSITION_MS = 460;
const SOUND_BAR_CENTERS = [-22, -11, 0, 11, 22];
const SOUND_BAR_HEIGHTS = [12, 19, 27, 18, 11];

type ActionPose = { angle: number; scaleX: number; scaleY: number; y: number };
type BlinkPose = { scaleX: number; scaleY: number; y: number };

export type MascotRuntime = {
  blinkStartedAt: number;
  current: NumericPose;
  lastActionPose: ActionPose;
  lastBlinkPose: BlinkPose;
  lastGlyphOverlay: { glyphReveal: number; meter: number; meterProgress: number; ring: number; ringRadius: number };
  name: MascotExpression;
  nextBlinkAt: number;
  queuedBlinkAt: number;
  /** Tempo: 1 is the designed pace, 2 is twice as fast. Scales breathing, blinks, actions and loops. */
  speed: number;
  stateStartedAt: number;
  transition: { durationMs: number; endsAt: number; from: NumericPose; fromBlink: BlinkPose; startedAt: number } | null;
};

type Stroke = { d: string; opacity: number; width: number };

export type MascotFrame = {
  aperture: string;
  apertureMatrix: number[];
  bars: { items: Array<{ d: string; width: number }>; opacity: number };
  core: string;
  coreMatrix: number[];
  dizzy: { opacity: number; angle: number };
  focus: { corners: Array<{ d: string; width: number }>; opacity: number };
  /** Snooze marks and a sweat drop, drawn in face space outside the eye glyphs. */
  accents: Array<{ d: string; opacity: number; width: number }>;
  haloOpacity: number;
  main: Stroke;
  meter: Stroke;
  ring: { dash: number[] | undefined; matrix: number[]; opacity: number; r: number; transform: string; width: number };
  second: Stroke;
  signal: { cx: number; opacity: number };
  track: Stroke;
  typing: { items: Array<{ d: string; width: number }>; opacity: number };
  wave: Stroke;
};

/** Fade the outgoing glyph away before revealing another family. Keep pose weights raw
 * so interrupted transitions resume from their current blend without a brightness jump.
 * Paired eyes and each multi-part glyph remain one family, including during blinks. */
function exclusiveGlyphOpacities(weights: number[]) {
  'worklet';
  let winner = 0;
  let strongest = 0;
  let runnerUp = 0;
  for (let index = 0; index < weights.length; index++) {
    const weight = weights[index];
    if (weight > strongest) {
      runnerUp = strongest;
      strongest = weight;
      winner = index;
    } else if (weight > runnerUp) {
      runnerUp = weight;
    }
  }
  return weights.map((_, index) => index === winner ? Math.max(0, strongest - runnerUp) : 0);
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  'worklet';
  return a + (b - a) * t;
}

function easeOutQuint(t: number) {
  'worklet';
  return 1 - Math.pow(1 - t, 5);
}

function smootherStep(t: number) {
  'worklet';
  const progress = clamp(t, 0, 1);
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

function singleArc(elapsed: number, duration: number, amplitude: number) {
  'worklet';
  const progress = clamp(elapsed / duration, 0, 1);
  return -Math.sin(progress * Math.PI) * amplitude;
}

function snapshot(source: NumericPose): NumericPose {
  'worklet';
  const next = { ...numericDefaults };
  for (const key of numericKeys) next[key] = source[key];
  return next;
}

function scheduleNextBlink(runtime: MascotRuntime, time: number, target: Expression) {
  'worklet';
  if (target.blinkMode === 'none' || target.blinkPeriod <= 0) {
    runtime.nextBlinkAt = Infinity;
    return;
  }
  const jitter = (Math.random() - 0.5) * target.blinkJitter;
  runtime.nextBlinkAt = time + Math.max(2.4, target.blinkPeriod + jitter) * 1000 / runtime.speed;
}

export function createMascotRuntime(name: MascotExpression, now: number): MascotRuntime {
  'worklet';
  const runtime: MascotRuntime = {
    blinkStartedAt: -Infinity,
    current: snapshot(expressions[name]),
    lastActionPose: { angle: 0, scaleX: 1, scaleY: 1, y: 0 },
    lastBlinkPose: { scaleX: 1, scaleY: 1, y: 0 },
    lastGlyphOverlay: { glyphReveal: 1, meter: 0, meterProgress: 0, ring: 0, ringRadius: 16 },
    name,
    nextBlinkAt: now + 3000,
    queuedBlinkAt: Infinity,
    speed: 1,
    // Start "settled" so a first render does not replay the entry action.
    stateStartedAt: now - 10_000,
    transition: null,
  };
  scheduleNextBlink(runtime, now, expressions[name]);
  return runtime;
}

export function setMascotExpression(runtime: MascotRuntime, name: MascotExpression, now: number, reduceMotion: boolean, transitionMs = MASCOT_TRANSITION_MS) {
  'worklet';
  if (runtime.name === name) return;
  runtime.name = name;
  const target = expressions[name];

  if (reduceMotion || transitionMs <= 0) {
    runtime.transition = null;
    runtime.current = snapshot(target);
    runtime.stateStartedAt = now;
    runtime.lastActionPose = { angle: 0, scaleX: 1, scaleY: 1, y: 0 };
    runtime.lastBlinkPose = { scaleX: 1, scaleY: 1, y: 0 };
    runtime.lastGlyphOverlay = { glyphReveal: 1, meter: 0, meterProgress: 0, ring: 0, ringRadius: 16 };
  } else {
    const from = snapshot(runtime.current);
    from.y += runtime.lastActionPose.y;
    from.scaleX *= runtime.lastActionPose.scaleX;
    from.scaleY *= runtime.lastActionPose.scaleY;
    from.angle += runtime.lastActionPose.angle;
    if (runtime.lastGlyphOverlay.meter > from.meter) {
      from.meter = runtime.lastGlyphOverlay.meter;
      from.meterProgress = runtime.lastGlyphOverlay.meterProgress;
    }
    if (runtime.lastGlyphOverlay.ring > from.ring) {
      from.ring = runtime.lastGlyphOverlay.ring;
      from.ringRadius = runtime.lastGlyphOverlay.ringRadius;
    }
    from.apertureOpacity *= runtime.lastGlyphOverlay.glyphReveal;
    runtime.transition = {
      durationMs: transitionMs,
      endsAt: now + transitionMs,
      from,
      fromBlink: { ...runtime.lastBlinkPose },
      startedAt: now,
    };
    runtime.stateStartedAt = now;
  }

  runtime.blinkStartedAt = -Infinity;
  runtime.queuedBlinkAt = Infinity;
  const blinkScheduleAt = runtime.transition?.endsAt ?? now;
  if (target.entryBlink === 'double') {
    runtime.nextBlinkAt = blinkScheduleAt + 180;
    runtime.queuedBlinkAt = blinkScheduleAt + 430;
  } else {
    scheduleNextBlink(runtime, blinkScheduleAt, target);
  }
}

/**
 * Returns the delay in ms until the mascot next needs a frame, or 0 when it needs frames now.
 * `breathVisible` is false for small renders where breathing would be sub-pixel.
 */
export function getMascotNextFrameDelay(runtime: MascotRuntime, time: number, reduceMotion: boolean, breathVisible: boolean) {
  'worklet';
  const target = expressions[runtime.name];
  if (runtime.transition) return 0;
  if (!reduceMotion && (breathVisible || continuousExpressions.includes(runtime.name))) return 0;
  const stateElapsedMs = time - runtime.stateStartedAt;
  if (!reduceMotion && target.action && stateElapsedMs < target.actionDuration * 1000 / runtime.speed + 80) return 0;
  const blinkEndsAt = runtime.blinkStartedAt + target.blinkDuration * 1000 / runtime.speed;
  if (time < blinkEndsAt) return 0;
  return Math.max(0, runtime.nextBlinkAt - time);
}

function aperturePath(centerX: number, centerY: number, length: number, rotation: number, curve: number, fold = 0, foldBias = 0) {
  'worklet';
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const point = (x: number, y: number) => `${(centerX + x * cos - y * sin).toFixed(2)} ${(centerY + x * sin + y * cos).toFixed(2)}`;
  const middleX = clamp(foldBias, -0.7, 0.7) * length * 0.24;
  const middleY = curve + fold;
  const controlY = curve + fold * 0.15;
  return [
    'M', point(-length / 2, 0),
    'Q', point((-length / 2 + middleX) / 2, controlY), point(middleX, middleY),
    'Q', point((middleX + length / 2) / 2, controlY), point(length / 2, 0),
  ].join(' ');
}

// Exact x bounds of the two quadratic segments, including rotated control points.
function apertureXBounds(center: number, length: number, rotation: number, curve: number, fold = 0, foldBias = 0) {
  'worklet';
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const middle = clamp(foldBias, -0.7, 0.7) * length * .24;
  const x0 = center - length / 2 * cos;
  const x1 = center + (-length / 2 + middle) / 2 * cos - (curve + fold * .15) * sin;
  const x2 = center + middle * cos - (curve + fold) * sin;
  const x3 = center + (middle + length / 2) / 2 * cos - (curve + fold * .15) * sin;
  const x4 = center + length / 2 * cos;
  let min = Math.min(x0, x2, x4), max = Math.max(x0, x2, x4);
  for (const [a, b, c] of [[x0, x1, x2], [x2, x3, x4]]) {
    const denominator = a - 2 * b + c;
    if (Math.abs(denominator) < .000001) continue;
    const t = (a - b) / denominator;
    if (t > 0 && t < 1) {
      const x = (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
      min = Math.min(min, x); max = Math.max(max, x);
    }
  }
  return { min, max };
}

function focusCornerPath(index: number, morph: number, spread: number) {
  'worklet';
  const initialCenterX = [-22, -7, 7, 22][index] ?? 0;
  const right = index % 2 === 1;
  const bottom = index >= 2;
  const outerX = (right ? 18 : -18) * spread;
  const innerX = (right ? 12 : -12) * spread;
  const outerY = (bottom ? 10 : -10) * spread;
  const innerY = (bottom ? 4 : -4) * spread;
  const initial = [
    { x: initialCenterX - 3, y: 0 },
    { x: initialCenterX, y: 0 },
    { x: initialCenterX + 3, y: 0 },
  ];
  const final = [
    { x: innerX, y: outerY },
    { x: outerX, y: outerY },
    { x: outerX, y: innerY },
  ];
  const points = initial.map((point, pointIndex) => ({
    x: lerp(point.x, final[pointIndex].x, morph),
    y: lerp(point.y, final[pointIndex].y, morph),
  }));
  return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)} L ${points[2].x.toFixed(2)} ${points[2].y.toFixed(2)}`;
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  'worklet';
  const commands = ['M', points[0].x.toFixed(2), points[0].y.toFixed(2)];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;
    commands.push(
      'C',
      (current.x + (next.x - previous.x) / 6).toFixed(2),
      (current.y + (next.y - previous.y) / 6).toFixed(2),
      (next.x - (following.x - current.x) / 6).toFixed(2),
      (next.y - (following.y - current.y) / 6).toFixed(2),
      next.x.toFixed(2),
      next.y.toFixed(2),
    );
  }
  return commands.join(' ');
}

function breathWavePath(length: number, amplitude: number, waveCenter: number) {
  'worklet';
  const points = [];
  const halfLength = length / 2;
  const spread = length * 0.17;
  for (let index = 0; index <= 20; index += 1) {
    const x = lerp(-halfLength, halfLength, index / 20);
    const distance = (x - waveCenter) / spread;
    const envelope = Math.exp(-distance * distance * 1.25);
    points.push({ x, y: Math.sin(distance * Math.PI) * envelope * amplitude });
  }
  return smoothPath(points);
}

const SNOOZES = [{ x: 44, y: -44, size: 9, phase: 0 }, { x: 58, y: -62, size: 6, phase: 0.5 }];

/** Fixed slots: two snooze marks and one sweat drop. A hidden slot keeps a harmless path. */
function accentStrokes(pose: NumericPose, elapsed: number) {
  'worklet';
  const snoozes = SNOOZES.map(({ x, y, size, phase }) => {
    // Each mark drifts up and fades out, then starts again.
    const cycle = ((elapsed / 2.6) + phase) % 1;
    const top = y - cycle * 8;
    return {
      d: `M ${x} ${top} L ${x + size} ${top} L ${x} ${top + size} L ${x + size} ${top + size}`,
      opacity: pose.snooze * (elapsed > 0 ? Math.sin(cycle * Math.PI) : 1),
      width: 2.6,
    };
  });
  const slide = (elapsed % 2.4) / 2.4 * 4;
  const sweat = {
    d: `M 46 ${-32 + slide} Q 52 ${-22 + slide} 46 ${-19 + slide} Q 40 ${-22 + slide} 46 ${-32 + slide}`,
    opacity: pose.sweat,
    width: 2.6,
  };
  return [...snoozes, sweat];
}

/** SVG affine matrix, avoiding string parsing on the native UI thread. */
export function mascotTransformMatrix(x: number, y: number, angle: number, scaleX = 1, scaleY = 1) {
  'worklet';
  const radians = angle * Math.PI / 180;
  const c = Math.cos(radians), s = Math.sin(radians);
  return [c * scaleX, s * scaleX, -s * scaleY, c * scaleY, x, y];
}

/**
 * Computes one frame and advances the runtime's transition/blink bookkeeping.
 * `bodyTravel` scales whole-body translation so compact renders keep the disk inside their box.
 */
export function computeMascotFrame(runtime: MascotRuntime, time: number, reduceMotion: boolean, bodyTravel = 1, gaze = { x: 0, y: 0 }): MascotFrame {
  'worklet';
  const target = expressions[runtime.name];
  const current = runtime.current;
  let isTransitioning = false;
  let transitionProgress = 1;
  let actionReveal = 1;

  const settleTo = (from: NumericPose, progress: number) => {
    for (const key of numericKeys) current[key] = lerp(from[key], target[key], progress);
  };

  if (reduceMotion && runtime.transition) {
    settleTo(target, 1);
    runtime.transition = null;
  } else if (runtime.transition) {
    if (time < runtime.transition.endsAt) {
      transitionProgress = smootherStep((time - runtime.transition.startedAt) / runtime.transition.durationMs);
      settleTo(runtime.transition.from, transitionProgress);
      isTransitioning = true;
      actionReveal = transitionProgress;
    } else {
      settleTo(target, 1);
      runtime.transition = null;
    }
  } else {
    settleTo(target, 1);
  }

  if (!isTransitioning && time >= runtime.nextBlinkAt) {
    runtime.blinkStartedAt = time;
    if (Number.isFinite(runtime.queuedBlinkAt)) {
      runtime.nextBlinkAt = runtime.queuedBlinkAt;
      runtime.queuedBlinkAt = Infinity;
    } else {
      scheduleNextBlink(runtime, time, target);
    }
  }

  const blinkProgress = clamp((time - runtime.blinkStartedAt) * runtime.speed / (target.blinkDuration * 1000), 0, 1);
  const blink = !isTransitioning && runtime.blinkStartedAt > 0 && blinkProgress < 1 ? Math.sin(blinkProgress * Math.PI) : 0;
  const breath = reduceMotion ? 0 : Math.sin((time / 1000) * runtime.speed * (Math.PI * 2 / current.breathPeriod)) * current.breathAmplitude;

  const rawStateElapsed = (time - runtime.stateStartedAt) / 1000;
  const stateElapsed = Math.max(0, rawStateElapsed) * runtime.speed;
  const actionName = rawStateElapsed >= 0 ? target.action : undefined;
  let actionY = 0;
  let actionScaleX = 1;
  let actionScaleY = 1;
  let actionAngle = 0;

  if (!reduceMotion && (actionName === 'success' || actionName === 'complete' || actionName === 'record')) {
    actionY = singleArc(stateElapsed, target.actionDuration, target.actionHeight);
    const load = Math.sin(clamp(stateElapsed / 0.14, 0, 1) * Math.PI) * 0.022;
    actionScaleX += load;
    actionScaleY -= load;
  } else if (!reduceMotion && actionName === 'drop') {
    const progress = clamp(stateElapsed / target.actionDuration, 0, 1);
    actionY = -18 * (1 - easeOutQuint(progress));
    const impact = Math.sin(clamp((progress - 0.62) / 0.38, 0, 1) * Math.PI) * 0.035;
    actionScaleX += impact;
    actionScaleY -= impact;
  } else if (!reduceMotion && actionName) {
    const progress = clamp(stateElapsed / target.actionDuration, 0, 1);
    const remainder = 1 - easeOutQuint(progress);
    switch (actionName) {
      case 'attend':
        actionY = 3 * Math.sin(progress * Math.PI);
        break;
      case 'nod':
        actionY = Math.sin(progress * Math.PI) * 5;
        actionAngle = Math.sin(progress * Math.PI) * -1.5;
        break;
      case 'settle':
        actionY = -7 * remainder;
        break;
      case 'lift':
        actionY = singleArc(stateElapsed, target.actionDuration, target.actionHeight);
        break;
      case 'rise':
        actionY = 10 * remainder;
        actionScaleY -= 0.018 * remainder;
        break;
      case 'open':
        actionScaleX -= 0.06 * remainder;
        actionScaleY -= 0.06 * remainder;
        break;
      case 'release':
        actionY = -8 * remainder;
        actionScaleX -= 0.035 * remainder;
        actionScaleY += 0.018 * remainder;
        break;
      case 'set':
        actionY = 9 * remainder;
        actionScaleX += 0.035 * remainder;
        actionScaleY -= 0.045 * remainder;
        break;
      case 'sink':
        actionY = -12 * remainder;
        actionAngle = -2 * remainder;
        break;
      case 'shortfall':
        actionY = -5 * remainder;
        break;
    }
  }

  actionY *= actionReveal;
  actionAngle *= actionReveal;
  actionScaleX = lerp(1, actionScaleX, actionReveal);
  actionScaleY = lerp(1, actionScaleY, actionReveal);
  runtime.lastActionPose = { angle: actionAngle, scaleX: actionScaleX, scaleY: actionScaleY, y: actionY };

  let performanceGazeX = 0;
  let performanceGazeY = 0;
  if (!reduceMotion && runtime.name === 'thinking') {
    performanceGazeX = Math.sin(stateElapsed * 0.9) * 0.9 * actionReveal;
    performanceGazeY = Math.cos(stateElapsed * 0.72) * 0.45 * actionReveal;
  }
  const gazeX = clamp(current.gazeX + performanceGazeX + gaze.x * 6, -6, 6);
  const gazeY = clamp(current.gazeY + performanceGazeY + gaze.y * 6, -6, 6);
  const faceX = current.x * bodyTravel;
  const faceY = (current.y + breath + actionY) * bodyTravel;
  const faceAngle = current.angle + actionAngle;
  const core = `translate(${faceX.toFixed(2)} ${faceY.toFixed(2)}) rotate(${faceAngle.toFixed(2)}) scale(${(current.scaleX * actionScaleX).toFixed(3)} ${(current.scaleY * actionScaleY).toFixed(3)})`;

  const blinkMode = target.blinkMode;
  let blinkScaleX = blinkMode === 'line' ? 1 - blink * 0.22 : blinkMode === 'closed' ? 1 - blink * 0.06 : 1;
  let blinkScaleY = blinkMode === 'vertical'
    ? 1 - blink * 0.82
    : blinkMode === 'pair'
      ? 1 - blink * 0.68
      : blinkMode === 'heavy'
        ? 1 - blink * 0.45
        : blinkMode === 'line'
          ? 1 - blink * 0.42
          : 1;
  let blinkY = blinkMode === 'closed' ? blink * 1.2 : blinkMode === 'heavy' ? blink * 0.8 : 0;
  if (runtime.transition) {
    blinkScaleX = lerp(runtime.transition.fromBlink.scaleX, blinkScaleX, transitionProgress);
    blinkScaleY = lerp(runtime.transition.fromBlink.scaleY, blinkScaleY, transitionProgress);
    blinkY = lerp(runtime.transition.fromBlink.y, blinkY, transitionProgress);
  }

  const split = clamp(current.split, 0, 1);
  const ring = clamp(current.ring, 0, 1);
  const twinLength = Math.max(8, (current.apertureWidth - current.eyeGap) / 2);
  const baseEyeLength = lerp(current.apertureWidth, twinLength, split);
  const lengthBalance = clamp(current.eyeLengthBalance, -0.42, 0.42);
  const blinkLengthScale = blinkMode === 'line' ? 1 - blink * 0.24 : 1;
  runtime.lastBlinkPose = { scaleX: blinkScaleX * blinkLengthScale, scaleY: blinkScaleY, y: blinkY };
  const leftEyeLength = baseEyeLength * (1 + lengthBalance) * blinkLengthScale;
  const rightEyeLength = baseEyeLength * (1 - lengthBalance) * blinkLengthScale;
  const eyeOffset = split * (current.eyeGap + baseEyeLength) / 2;
  const eyeRotation = current.eyeRotation * split;
  const eyeSplay = current.eyeSplay * split;
  const leftEyeY = -current.eyeOffsetY * split;
  const rightEyeY = current.eyeOffsetY * split;
  const leftCurve = current.apertureCurve + current.eyeCurveBalance * split;
  const rightCurve = current.apertureCurve - current.eyeCurveBalance * split;
  const renderedFold = current.apertureFold * (1 - split);
  const leftFold = renderedFold - current.eyeFold * split;
  const rightFold = current.eyeFold * split;
  const leftBounds = apertureXBounds(-eyeOffset, leftEyeLength, eyeRotation + eyeSplay, leftCurve, leftFold, current.foldBias * (1 - split));
  const rightBounds = apertureXBounds(eyeOffset, rightEyeLength, eyeRotation - eyeSplay, rightCurve, rightFold);
  const eyeCenter = -(Math.min(leftBounds.min, rightBounds.min) + Math.max(leftBounds.max, rightBounds.max)) / 2 * split;
  const recordProgress = actionName === 'record' ? clamp(stateElapsed / target.actionDuration, 0, 1) : 1;
  const recordRing = actionName === 'record' && !reduceMotion
    ? Math.sin(clamp((recordProgress - 0.08) / 0.62, 0, 1) * Math.PI) * actionReveal
    : 0;
  const ringBlink = blinkMode === 'ring' ? blink : 0;
  const renderedRing = Math.max(ring, recordRing);
  const ringLineOpacity = ring * ringBlink;
  let glyphReveal = 1;
  let eventMeterOpacity = 0;
  let eventMeterProgress = current.meterProgress;

  if (!reduceMotion && actionName === 'complete') {
    const fill = easeOutQuint(clamp(stateElapsed / 0.3, 0, 1));
    const handoff = easeOutQuint(clamp((stateElapsed - 0.26) / 0.28, 0, 1));
    eventMeterOpacity = (1 - handoff) * actionReveal;
    eventMeterProgress = lerp(0.45, 1, fill);
    glyphReveal = lerp(1, handoff, actionReveal);
  } else if (!reduceMotion && actionName === 'record') {
    const fill = easeOutQuint(clamp(stateElapsed / 0.28, 0, 1));
    const handoff = easeOutQuint(clamp((stateElapsed - 0.42) / 0.22, 0, 1));
    eventMeterOpacity = (1 - easeOutQuint(clamp((stateElapsed - 0.24) / 0.18, 0, 1))) * actionReveal;
    eventMeterProgress = lerp(0.68, 1.12, fill);
    glyphReveal = lerp(1, handoff, actionReveal);
  }

  let meterProgress = current.meterProgress;
  if (runtime.name === 'rest') {
    meterProgress = reduceMotion ? 0.62 : clamp(0.08 + stateElapsed / 8 * 0.92, 0.08, 1);
  } else if (runtime.name === 'missed' && !reduceMotion) {
    meterProgress = lerp(0.12, current.meterProgress, easeOutQuint(clamp(stateElapsed / expressions.missed.actionDuration, 0, 1)));
  }
  if (eventMeterOpacity > 0) meterProgress = eventMeterProgress;

  const meterOpacity = Math.max(current.meter, eventMeterOpacity);
  const lineOpacity = Math.max(1 - renderedRing, ringLineOpacity) * current.apertureOpacity * glyphReveal;
  runtime.lastGlyphOverlay.meter = meterOpacity;
  runtime.lastGlyphOverlay.meterProgress = meterProgress;
  runtime.lastGlyphOverlay.glyphReveal = glyphReveal;

  const aperture = `translate(${(gazeX * 0.8).toFixed(2)} ${(current.apertureY + gazeY * 0.55 + blinkY).toFixed(2)}) rotate(${current.apertureAngle.toFixed(2)}) scale(${blinkScaleX.toFixed(3)} ${blinkScaleY.toFixed(3)})`;
  const meterWidth = current.apertureWidth;
  const meterFillWidth = Math.max(3, meterWidth * clamp(meterProgress, 0.04, 1.16));
  const meterCenterX = -meterWidth / 2 + meterFillWidth / 2;
  const thickness = current.apertureThickness;

  const watchingPulse = runtime.name === 'watching' && !reduceMotion ? Math.sin(stateElapsed * 1.35) * 0.45 * actionReveal : 0;
  const ringRadius = recordRing > ring ? lerp(15, 22, recordRing) : current.ringRadius + watchingPulse - ringBlink * 1.2;
  runtime.lastGlyphOverlay.ring = renderedRing * (1 - ringBlink);
  runtime.lastGlyphOverlay.ringRadius = ringRadius;
  const circumference = Math.PI * 2 * ringRadius;
  const spinnerAngle = reduceMotion ? 0 : stateElapsed * 220 * current.spinner;

  const breathWaveMorph = clamp(current.breathWave, 0, 1);
  const waveTravel = clamp((stateElapsed % 7.2) / 2.8, 0, 1);
  const waveCenter = runtime.name === 'recovery'
    ? reduceMotion ? 0 : lerp(-current.apertureWidth * 0.8, current.apertureWidth * 0.8, waveTravel)
    : current.apertureWidth * 0.8;

  const focusMorph = clamp(current.focusReticle, 0, 1);
  const focusTurn = focusMorph * focusMorph * (3 - 2 * focusMorph);
  const focusArrival = runtime.name === 'focused' ? easeOutQuint(clamp(stateElapsed / 0.52, 0, 1)) : 1;
  const focusSpread = reduceMotion ? 1 : lerp(1.18, 1, focusArrival);

  const soundBarMorph = clamp(current.soundBars, 0, 1);
  const soundBarTurn = soundBarMorph * soundBarMorph * (3 - 2 * soundBarMorph);
  const typingMorph = clamp(current.typingDots, 0, 1);
  const typingTurn = typingMorph * typingMorph * (3 - 2 * typingMorph);
  const scanPhase = (stateElapsed % 1.7) / 1.7;
  const [visibleLine, visibleRing, visibleMeter, visibleFocus, visibleBars, visibleTyping, visibleWave, visibleDizzy] = exclusiveGlyphOpacities([
    lineOpacity, renderedRing * (1 - ringBlink), meterOpacity,
    focusMorph * glyphReveal * (1 - renderedRing), soundBarMorph * glyphReveal * (1 - renderedRing),
    typingMorph * glyphReveal * (1 - renderedRing), breathWaveMorph * glyphReveal * (1 - renderedRing), current.dizzy,
  ]);

  return {
    accents: accentStrokes(current, reduceMotion ? 0 : stateElapsed),
    aperture,
    apertureMatrix: mascotTransformMatrix(gazeX * 0.8, current.apertureY + gazeY * 0.55 + blinkY, current.apertureAngle, blinkScaleX, blinkScaleY),
    bars: {
      items: SOUND_BAR_CENTERS.map((center, index) => {
        const liveLevel = runtime.name === 'speaking' && !reduceMotion
          ? 0.9 + Math.sin(stateElapsed * (2.25 + index * 0.08) + index * 1.13) * 0.1 + Math.sin(stateElapsed * 1.1 + index * 0.71) * 0.045
          : 1;
        return {
          d: aperturePath(center, 0, lerp(7, SOUND_BAR_HEIGHTS[index] * liveLevel, soundBarTurn), lerp(0, 90, soundBarTurn), 0),
          width: lerp(thickness * 0.78, 5.5, soundBarTurn),
        };
      }),
      opacity: visibleBars,
    },
    core,
    coreMatrix: mascotTransformMatrix(faceX, faceY, faceAngle, current.scaleX * actionScaleX, current.scaleY * actionScaleY),
    focus: {
      corners: [0, 1, 2, 3].map(index => ({
        d: focusCornerPath(index, focusTurn, focusSpread),
        width: lerp(thickness * 0.72, 4.2, focusTurn),
      })),
      opacity: visibleFocus,
    },
    dizzy: { opacity: visibleDizzy, angle: reduceMotion ? 0 : stateElapsed * 300 },
    haloOpacity: current.haloEnergy,
    main: {
      d: aperturePath(-eyeOffset + eyeCenter, leftEyeY, leftEyeLength, eyeRotation + eyeSplay, leftCurve, leftFold, current.foldBias * (1 - split)),
      opacity: visibleLine,
      width: thickness,
    },
    meter: {
      d: aperturePath(meterCenterX, 0, meterFillWidth, 0, 0, current.apertureFold * clamp(meterProgress, 0, 1), current.foldBias),
      opacity: visibleMeter,
      width: thickness,
    },
    ring: {
      dash: current.spinner > 0.01 ? [circumference * 0.73, circumference * 0.27] : undefined,
      matrix: mascotTransformMatrix(0, 0, spinnerAngle, 1 - ringBlink * 0.08, 1 - ringBlink * 0.08),
      opacity: visibleRing,
      r: ringRadius,
      transform: `rotate(${spinnerAngle.toFixed(2)}) scale(${(1 - ringBlink * 0.08).toFixed(3)})`,
      width: thickness,
    },
    second: {
      d: aperturePath(eyeOffset + eyeCenter, rightEyeY, rightEyeLength, eyeRotation - eyeSplay, rightCurve, rightFold),
      opacity: visibleLine * clamp(split * 1.35, 0, 1),
      width: thickness,
    },
    signal: {
      cx: lerp(-current.apertureWidth * 0.42, current.apertureWidth * 0.42, scanPhase),
      opacity: reduceMotion ? 0 : current.scan * Math.sin(scanPhase * Math.PI) * visibleLine,
    },
    track: {
      d: aperturePath(0, 0, meterWidth, 0, 0, current.apertureFold, current.foldBias),
      opacity: visibleMeter * 0.16,
      width: thickness,
    },
    typing: {
      items: [0, 1, 2].map(index => {
        const typingLift = runtime.name === 'typing' && !reduceMotion
          ? Math.max(0, Math.sin((stateElapsed * 1.05 - index * 0.17) * Math.PI * 2))
          : 0;
        return {
          d: aperturePath(lerp(-18 + index * 18, -14 + index * 14, typingTurn), -4.2 * typingLift * typingTurn, lerp(8, 0.4, typingTurn), 0, 0),
          width: lerp(thickness * 0.78, 8, typingTurn),
        };
      }),
      opacity: visibleTyping,
    },
    wave: {
      d: breathWavePath(current.apertureWidth, lerp(0, reduceMotion ? 2.4 : 3.4, breathWaveMorph), waveCenter),
      opacity: visibleWave,
      width: lerp(thickness * 0.78, 4, breathWaveMorph),
    },
  };
}
