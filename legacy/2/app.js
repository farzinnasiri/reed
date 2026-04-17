'use strict';

function metricDef(config) {
  return config;
}

const CATEGORY_DEFS = {
  barbell: {
    label: 'Barbell',
    summary: 'Bilateral load, reps, and effort',
    buildMetrics(exercise) {
      return [
        metricDef({
          key: 'load',
          label: exercise.loadLabel ?? 'Load (kg)',
          step: exercise.loadStep ?? 2.5,
          min: 0,
          max: exercise.maxLoad ?? 300,
          accent: 'accent-1',
          format: 'weight',
          summaryFormatter: value => `${fmtWeight(value)} kg`
        }),
        metricDef({
          key: 'reps',
          label: 'Reps',
          step: 1,
          min: 0,
          max: 40,
          accent: 'main',
          format: 'integer',
          summaryFormatter: value => `${value} reps`
        }),
        metricDef({
          key: 'rpe',
          label: 'Target RPE',
          step: 0.5,
          min: 5,
          max: 10,
          accent: 'accent-2',
          format: 'rpe',
          summaryFormatter: value => `RPE ${fmtRpe(value)}`
        })
      ];
    }
  },
  dumbbellPair: {
    label: 'Dumbbell Pair',
    summary: 'Per-hand dumbbell load with straight-set tracking',
    buildMetrics(exercise) {
      return [
        metricDef({
          key: 'load',
          label: exercise.loadLabel ?? 'Each hand (kg)',
          step: exercise.loadStep ?? 1,
          min: 0,
          max: exercise.maxLoad ?? 80,
          accent: 'accent-1',
          format: 'weight',
          summaryFormatter: value => `Each ${fmtWeight(value)} kg`
        }),
        metricDef({
          key: 'reps',
          label: 'Reps',
          step: 1,
          min: 0,
          max: 40,
          accent: 'main',
          format: 'integer',
          summaryFormatter: value => `${value} reps`
        }),
        metricDef({
          key: 'rpe',
          label: 'Target RPE',
          step: 0.5,
          min: 5,
          max: 10,
          accent: 'accent-2',
          format: 'rpe',
          summaryFormatter: value => `RPE ${fmtRpe(value)}`
        })
      ];
    }
  },
  unilateral: {
    label: 'Asymmetric',
    summary: 'Left and right loads tracked independently',
    buildMetrics(exercise) {
      const step = exercise.loadStep ?? 1;
      return [
        metricDef({
          key: 'leftLoad',
          label: exercise.leftLabel ?? 'Left load',
          step,
          min: 0,
          max: exercise.maxLoad ?? 80,
          accent: 'accent-1',
          format: 'weight',
          summaryFormatter: value => `L ${fmtWeight(value)} kg`
        }),
        metricDef({
          key: 'rightLoad',
          label: exercise.rightLabel ?? 'Right load',
          step,
          min: 0,
          max: exercise.maxLoad ?? 80,
          accent: 'main',
          format: 'weight',
          summaryFormatter: value => `R ${fmtWeight(value)} kg`
        }),
        metricDef({
          key: 'reps',
          label: 'Reps',
          step: 1,
          min: 0,
          max: 40,
          accent: 'main',
          format: 'integer',
          summaryFormatter: value => `${value} reps`
        }),
        metricDef({
          key: 'rpe',
          label: 'Target RPE',
          step: 0.5,
          min: 5,
          max: 10,
          accent: 'accent-2',
          format: 'rpe',
          summaryFormatter: value => `RPE ${fmtRpe(value)}`
        })
      ];
    }
  },
  bodyweight: {
    label: 'Bodyweight',
    summary: 'Reps with assist or added load',
    buildMetrics(exercise) {
      const loadLabel = exercise.loadLabel ?? 'Added load (kg)';
      const summaryFormatter = exercise.loadMode === 'assist'
        ? value => `Assist ${fmtWeight(value)} kg`
        : value => `+${fmtWeight(value)} kg`;

      return [
        metricDef({
          key: 'load',
          label: loadLabel,
          step: exercise.loadStep ?? 2.5,
          min: 0,
          max: exercise.maxLoad ?? 80,
          accent: 'accent-1',
          format: 'weight',
          summaryFormatter
        }),
        metricDef({
          key: 'reps',
          label: 'Reps',
          step: 1,
          min: 0,
          max: 40,
          accent: 'main',
          format: 'integer',
          summaryFormatter: value => `${value} reps`
        }),
        metricDef({
          key: 'rpe',
          label: 'Target RPE',
          step: 0.5,
          min: 5,
          max: 10,
          accent: 'accent-2',
          format: 'rpe',
          summaryFormatter: value => `RPE ${fmtRpe(value)}`
        })
      ];
    }
  },
  timed: {
    label: 'Timed Hold',
    summary: 'Hold-based work with time-first control',
    buildMetrics(exercise) {
      return [
        metricDef({
          key: 'duration',
          label: exercise.timeLabel ?? 'Hold time',
          step: exercise.timeStep ?? 5,
          min: 10,
          max: exercise.maxDuration ?? 240,
          accent: 'accent-1',
          format: 'duration',
          summaryFormatter: value => `${fmtSeconds(value)} hold`
        }),
        metricDef({
          key: 'load',
          label: exercise.loadLabel ?? 'Load (kg)',
          step: exercise.loadStep ?? 2.5,
          min: 0,
          max: exercise.maxLoad ?? 60,
          accent: 'main',
          format: 'weight',
          summaryFormatter: value => `${fmtWeight(value)} kg`
        }),
        metricDef({
          key: 'rounds',
          label: 'Rounds',
          step: 1,
          min: 1,
          max: 8,
          accent: 'main',
          format: 'integer',
          summaryFormatter: value => `${value} rounds`
        }),
        metricDef({
          key: 'rpe',
          label: 'Target RPE',
          step: 0.5,
          min: 5,
          max: 10,
          accent: 'accent-2',
          format: 'rpe',
          summaryFormatter: value => `RPE ${fmtRpe(value)}`
        })
      ];
    }
  }
};

const PLANS = [
  {
    id: 'power-push',
    name: 'Power Push',
    audience: 'Gym strength',
    note: 'Classic pressing session with bilateral barbell work and a per-hand dumbbell accessory.',
    exercises: [
      {
        name: 'Bench Press',
        category: 'barbell',
        loadStep: 2.5,
        rest: 90,
        sets: [
          { type: 'warmup', values: { load: 40, reps: 8, rpe: 7.5 }, prev: { load: 40, reps: 7, rpe: 7 } },
          { type: 'working', values: { load: 62.5, reps: 8, rpe: 8 }, prev: { load: 60, reps: 8, rpe: 8 } },
          { type: 'working', values: { load: 65, reps: 8, rpe: 8.5 }, prev: { load: 62.5, reps: 8, rpe: 8.5 } },
          { type: 'working', values: { load: 70, reps: 6, rpe: 9 }, prev: { load: 67.5, reps: 7, rpe: 9 } }
        ]
      },
      {
        name: 'Overhead Press',
        category: 'barbell',
        loadStep: 2.5,
        rest: 90,
        sets: [
          { type: 'warmup', values: { load: 20, reps: 8, rpe: 7 }, prev: { load: 20, reps: 6, rpe: 7 } },
          { type: 'working', values: { load: 40, reps: 8, rpe: 8 }, prev: { load: 37.5, reps: 8, rpe: 8 } },
          { type: 'working', values: { load: 40, reps: 6, rpe: 8.5 }, prev: { load: 37.5, reps: 6, rpe: 8.5 } }
        ]
      },
      {
        name: 'Incline DB Press',
        category: 'dumbbellPair',
        loadStep: 1,
        rest: 75,
        sets: [
          { type: 'working', values: { load: 22, reps: 10, rpe: 8 }, prev: { load: 20, reps: 10, rpe: 8 } },
          { type: 'working', values: { load: 22, reps: 10, rpe: 8.5 }, prev: { load: 20, reps: 9, rpe: 8.5 } },
          { type: 'working', values: { load: 22, reps: 8, rpe: 9 }, prev: { load: 20, reps: 8, rpe: 9 } }
        ]
      }
    ]
  },
  {
    id: 'street-strength',
    name: 'Street Strength',
    audience: 'Calisthenics',
    note: 'Bodyweight movements with either added load, assistance, or a pure timed hold.',
    exercises: [
      {
        name: 'Weighted Pull-Up',
        category: 'bodyweight',
        loadMode: 'added',
        loadLabel: 'Added load (kg)',
        loadStep: 2.5,
        rest: 120,
        sets: [
          { type: 'working', values: { load: 10, reps: 6, rpe: 8 }, prev: { load: 7.5, reps: 6, rpe: 8 } },
          { type: 'working', values: { load: 10, reps: 6, rpe: 8.5 }, prev: { load: 7.5, reps: 5, rpe: 8.5 } },
          { type: 'working', values: { load: 7.5, reps: 8, rpe: 9 }, prev: { load: 5, reps: 8, rpe: 9 } }
        ]
      },
      {
        name: 'Ring Dip',
        category: 'bodyweight',
        loadMode: 'assist',
        loadLabel: 'Assist (kg)',
        loadStep: 2.5,
        rest: 90,
        sets: [
          { type: 'working', values: { load: 17.5, reps: 8, rpe: 7.5 }, prev: { load: 20, reps: 8, rpe: 7.5 } },
          { type: 'working', values: { load: 15, reps: 8, rpe: 8 }, prev: { load: 17.5, reps: 8, rpe: 8 } },
          { type: 'working', values: { load: 12.5, reps: 6, rpe: 8.5 }, prev: { load: 15, reps: 6, rpe: 8.5 } }
        ]
      },
      {
        name: 'Hollow Hold',
        category: 'timed',
        timeLabel: 'Hold time',
        timeStep: 5,
        loadLabel: 'Load (kg)',
        loadStep: 2.5,
        rest: 60,
        sets: [
          { type: 'working', values: { duration: 30, load: 0, rounds: 2, rpe: 7.5 }, prev: { duration: 25, load: 0, rounds: 2, rpe: 7 } },
          { type: 'working', values: { duration: 35, load: 0, rounds: 2, rpe: 8 }, prev: { duration: 30, load: 0, rounds: 2, rpe: 8 } },
          { type: 'working', values: { duration: 40, load: 5, rounds: 1, rpe: 8.5 }, prev: { duration: 35, load: 0, rounds: 1, rpe: 8.5 } }
        ]
      }
    ]
  },
  {
    id: 'balance-build',
    name: 'Balance Build',
    audience: 'Unilateral',
    note: 'Left-right control work for athletes, rehab blocks, or imbalance cleanup.',
    exercises: [
      {
        name: 'Bulgarian Split Squat',
        category: 'unilateral',
        loadStep: 1,
        leftLabel: 'Left load (kg)',
        rightLabel: 'Right load (kg)',
        rest: 90,
        sets: [
          { type: 'working', values: { leftLoad: 18, rightLoad: 18, reps: 10, rpe: 8 }, prev: { leftLoad: 16, rightLoad: 16, reps: 10, rpe: 8 } },
          { type: 'working', values: { leftLoad: 20, rightLoad: 18, reps: 8, rpe: 8.5 }, prev: { leftLoad: 18, rightLoad: 18, reps: 8, rpe: 8.5 } },
          { type: 'working', values: { leftLoad: 20, rightLoad: 20, reps: 8, rpe: 9 }, prev: { leftLoad: 18, rightLoad: 18, reps: 8, rpe: 9 } }
        ]
      },
      {
        name: 'Single-Arm Cable Row',
        category: 'unilateral',
        loadStep: 2.5,
        leftLabel: 'Left stack (kg)',
        rightLabel: 'Right stack (kg)',
        rest: 75,
        sets: [
          { type: 'working', values: { leftLoad: 25, rightLoad: 22.5, reps: 12, rpe: 7.5 }, prev: { leftLoad: 22.5, rightLoad: 20, reps: 12, rpe: 7.5 } },
          { type: 'working', values: { leftLoad: 27.5, rightLoad: 25, reps: 10, rpe: 8 }, prev: { leftLoad: 25, rightLoad: 22.5, reps: 10, rpe: 8 } },
          { type: 'working', values: { leftLoad: 27.5, rightLoad: 25, reps: 10, rpe: 8.5 }, prev: { leftLoad: 25, rightLoad: 22.5, reps: 10, rpe: 8.5 } }
        ]
      },
      {
        name: 'Copenhagen Plank',
        category: 'timed',
        timeLabel: 'Hold time',
        timeStep: 5,
        loadLabel: 'Plate (kg)',
        loadStep: 2.5,
        rest: 45,
        sets: [
          { type: 'working', values: { duration: 20, load: 0, rounds: 2, rpe: 7.5 }, prev: { duration: 15, load: 0, rounds: 2, rpe: 7.5 } },
          { type: 'working', values: { duration: 25, load: 0, rounds: 2, rpe: 8 }, prev: { duration: 20, load: 0, rounds: 2, rpe: 8 } },
          { type: 'working', values: { duration: 25, load: 5, rounds: 2, rpe: 8.5 }, prev: { duration: 20, load: 2.5, rounds: 2, rpe: 8.5 } }
        ]
      }
    ]
  }
];

const ITEM_HEIGHT = 24;
const SCROLLER_HEIGHT = 120;
const PADDING_OFFSET = (SCROLLER_HEIGHT / 2) - (ITEM_HEIGHT / 2);
const SWIPE_THRESHOLD = 120;
const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * 92;

function createEmptyRecords(plan) {
  return plan.exercises.map(exercise => exercise.sets.map(() => null));
}

function createEmptyNotes(plan) {
  return plan.exercises.map(() => '');
}

const state = {
  planIdx: 0,
  exIdx: 0,
  setIdx: 0,
  currentValues: {},
  theme: 'light',
  tab: 'exercise',
  cardMode: 'set',
  restDuration: 90,
  restRemaining: 90,
  restRunning: false,
  restTimerId: null,
  toastId: null,
  workoutDone: false,
  records: createEmptyRecords(PLANS[0]),
  exerciseNotes: createEmptyNotes(PLANS[0]),
  startX: 0,
  currentX: 0,
  dragging: false
};

const $ = id => document.getElementById(id);
const scrollers = {};

function currentPlan() {
  return PLANS[state.planIdx];
}

function currentExercises() {
  return currentPlan().exercises;
}

function currentExercise() {
  return currentExercises()[state.exIdx];
}

function currentSet() {
  return currentExercise().sets[state.setIdx];
}

function getMetricDefs(exercise = currentExercise()) {
  return CATEGORY_DEFS[exercise.category].buildMetrics(exercise);
}

function getRecord(exIdx, setIdx) {
  return state.records[exIdx][setIdx];
}

function getTarget(exIdx, setIdx) {
  const exercise = currentExercises()[exIdx];
  return { exercise, set: exercise.sets[setIdx], exIdx, setIdx };
}

function getNextTarget() {
  const exercises = currentExercises();
  const exercise = exercises[state.exIdx];
  if (state.setIdx < exercise.sets.length - 1) {
    return getTarget(state.exIdx, state.setIdx + 1);
  }
  if (state.exIdx < exercises.length - 1) {
    return getTarget(state.exIdx + 1, 0);
  }
  return null;
}

function getPreviousTarget() {
  if (state.setIdx > 0) {
    return getTarget(state.exIdx, state.setIdx - 1);
  }
  if (state.exIdx > 0) {
    const previousExercise = currentExercises()[state.exIdx - 1];
    return getTarget(state.exIdx - 1, previousExercise.sets.length - 1);
  }
  return null;
}

function getUpcomingTarget() {
  if (state.workoutDone) return null;
  return getTarget(state.exIdx, state.setIdx);
}

function syncInputsFromTarget(exIdx, setIdx) {
  const record = getRecord(exIdx, setIdx);
  const values = record ? record.values : currentExercises()[exIdx].sets[setIdx].values;
  state.currentValues = { ...values };
}

function fmtWeight(value) {
  return Number.isInteger(value) ? `${value}.0` : value.toFixed(1);
}

function fmtRpe(value) {
  return Number.isInteger(value) ? `${value}.0` : value.toFixed(1);
}

function fmtSeconds(total) {
  const safe = Math.max(0, Math.round(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function buildRange(min, max, step) {
  const values = [];
  for (let value = min; value <= max + 0.001; value = Math.round((value + step) * 1000) / 1000) {
    values.push(value);
  }
  return values;
}

function formatMetricValue(metric, value) {
  if (metric.format === 'weight') return fmtWeight(value);
  if (metric.format === 'rpe') return fmtRpe(value);
  if (metric.format === 'duration') return fmtSeconds(value);
  return String(value);
}

function summarizeValues(exercise, values) {
  return getMetricDefs(exercise)
    .map(metric => metric.summaryFormatter(values[metric.key]))
    .join(' · ');
}

function metricLabelWithPrevious(metric, previousValues) {
  const previousValue = previousValues?.[metric.key];
  if (previousValue === undefined || previousValue === null) {
    return metric.label;
  }
  return `${metric.label} · Prev ${formatMetricValue(metric, previousValue)}`;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastId);
  state.toastId = setTimeout(() => toast.classList.remove('show'), 1300);
}

function countLoggedSets() {
  return state.records.reduce(
    (total, exerciseRecords) => total + exerciseRecords.filter(Boolean).length,
    0
  );
}

function countRemainingSets() {
  if (state.workoutDone) return 0;

  let remaining = 0;
  currentExercises().forEach((exercise, exIdx) => {
    exercise.sets.forEach((set, setIdx) => {
      if (state.records[exIdx][setIdx]) return;
      if (exIdx > state.exIdx || (exIdx === state.exIdx && setIdx >= state.setIdx)) {
        remaining += 1;
      }
    });
  });
  return remaining;
}

function getCategoryCounts(plan = currentPlan()) {
  return plan.exercises.reduce((counts, exercise) => {
    counts[exercise.category] = (counts[exercise.category] || 0) + 1;
    return counts;
  }, {});
}

function scrollerAccentClass(metric) {
  if (metric.accent === 'accent-1') return 'th-accent-1';
  if (metric.accent === 'accent-2') return 'th-accent-2';
  return 'th-text-main';
}

function indicatorClass(metric) {
  if (metric.accent === 'accent-1') return 'indicator-accent-1';
  if (metric.accent === 'accent-2') return 'indicator-accent-2';
  return 'indicator-main';
}

function renderMetricRows() {
  const host = $('metricsStack');
  Object.keys(scrollers).forEach(key => delete scrollers[key]);

  if (state.workoutDone) {
    host.className = 'metrics-stack is-finished';
    host.innerHTML = `
      <div class="finish-state">
        <div class="finish-title">Session complete</div>
        <div class="finish-copy">This mock plan is done. Switch programs in the workout tab to preview a different exercise flow.</div>
      </div>
    `;
    return;
  }

  const metrics = getMetricDefs();
  const previousValues = currentSet().prev;
  host.className = `metrics-stack${metrics.length > 3 ? ' is-dense' : ''}`;
  host.innerHTML = '';

  metrics.forEach(metric => {
    const row = document.createElement('section');
    row.className = 'metric-row';
    row.innerHTML = `
      <div class="metric-copy">
        <span class="metric-label th-text-muted">${metricLabelWithPrevious(metric, previousValues)}</span>
        <div class="metric-value ${scrollerAccentClass(metric)} th-display-num" id="metric-display-${metric.key}">
          ${formatMetricValue(metric, state.currentValues[metric.key])}
        </div>
      </div>
      <div class="metric-picker">
        <div class="center-indicator ${indicatorClass(metric)}"></div>
        <div class="metric-scroller th-dial scroll-mask no-scrollbar" id="metric-scroller-${metric.key}" aria-label="${metric.label} scroller"></div>
      </div>
    `;
    host.appendChild(row);

    scrollers[metric.key] = {
      metric,
      display: $(`metric-display-${metric.key}`),
      el: $(`metric-scroller-${metric.key}`)
    };
  });

  Object.values(scrollers).forEach(({ metric, el }) => {
    populateScroller(metric, state.currentValues[metric.key]);
    el.addEventListener('scroll', () => updateScroller(metric.key));
  });
}

function isMajorTick(metric, value) {
  if (metric.format === 'duration') return value % 15 === 0;
  if (metric.format === 'integer') return value % 5 === 0;
  return Math.abs(value % 1) < 0.001;
}

function populateScroller(metric, initialValue) {
  const scroller = scrollers[metric.key].el;
  scroller.innerHTML = '';

  const paddingTop = document.createElement('div');
  paddingTop.style.height = `${PADDING_OFFSET}px`;
  scroller.appendChild(paddingTop);

  const values = buildRange(metric.min, metric.max, metric.step);
  let targetScrollTop = 0;

  values.forEach((value, index) => {
    const row = document.createElement('div');
    row.className = 'scroll-item';
    row.dataset.value = String(value);

    const tick = document.createElement('div');
    tick.className = `tick-mark ${isMajorTick(metric, value) ? 'tick-major' : 'tick-minor'}`;
    row.appendChild(tick);
    scroller.appendChild(row);

    if (Math.abs(value - initialValue) < 0.001) {
      targetScrollTop = index * ITEM_HEIGHT;
    }
  });

  const paddingBottom = document.createElement('div');
  paddingBottom.style.height = `${PADDING_OFFSET}px`;
  scroller.appendChild(paddingBottom);

  requestAnimationFrame(() => {
    scroller.scrollTop = targetScrollTop;
    updateScroller(metric.key);
  });
}

function updateScroller(key) {
  const cfg = scrollers[key];
  if (!cfg) return;

  const items = cfg.el.querySelectorAll('.scroll-item');
  if (!items.length) return;

  const index = Math.max(0, Math.min(items.length - 1, Math.round(cfg.el.scrollTop / ITEM_HEIGHT)));
  items.forEach(item => item.classList.remove('active'));

  const active = items[index];
  if (!active) return;

  active.classList.add('active');
  const value = Number(active.dataset.value);
  cfg.display.textContent = formatMetricValue(cfg.metric, value);
  state.currentValues[key] = value;
}

function updateThemeUI() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('themeIcon').textContent = state.theme === 'light' ? '☾' : '☀';
  $('themeLabel').textContent = state.theme === 'light' ? 'Light' : 'Dark';
}

function updateTabUI() {
  const isExercise = state.tab === 'exercise';
  $('exerciseView').classList.toggle('is-active', isExercise);
  $('workoutView').classList.toggle('is-active', !isExercise);
  $('exerciseTabBtn').classList.toggle('th-pill-active', isExercise);
  $('exerciseTabBtn').classList.toggle('th-pill-inactive', !isExercise);
  $('exerciseTabBtn').setAttribute('aria-current', isExercise ? 'page' : 'false');
  $('workoutTabBtn').classList.toggle('th-pill-active', !isExercise);
  $('workoutTabBtn').classList.toggle('th-pill-inactive', isExercise);
  $('workoutTabBtn').setAttribute('aria-current', !isExercise ? 'page' : 'false');
}

function stopRestTimer() {
  clearInterval(state.restTimerId);
  state.restTimerId = null;
  state.restRunning = false;
}

function updateTimerRing() {
  const progress = state.restDuration > 0 ? state.restRemaining / state.restDuration : 0;
  $('timerRing').style.strokeDasharray = `${TIMER_RING_CIRCUMFERENCE}`;
  $('timerRing').style.strokeDashoffset = `${TIMER_RING_CIRCUMFERENCE * (1 - progress)}`;
}

function updatePresetButtons() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('is-selected', Number(btn.dataset.preset) === state.restDuration);
  });
}

function updateRestUI(target = getUpcomingTarget()) {
  $('timerValue').textContent = fmtSeconds(state.restRemaining);
  $('timerState').textContent = state.restRunning ? 'Tap to pause' : 'Tap to start';
  updateTimerRing();

  if (!target) {
    $('restNext').textContent = 'Up next: Workout complete';
    return;
  }

  $('restNext').textContent = `Up next: ${target.exercise.name} · Set ${target.setIdx + 1} · ${summarizeValues(target.exercise, target.set.values)}`;
}

function showSetCard() {
  state.cardMode = 'set';
  stopRestTimer();
  $('swipeCard').dataset.cardMode = 'set';
  $('setView').classList.add('is-active');
  $('timerView').classList.remove('is-active');
  $('swipeHint').textContent = 'Swipe right to log set';
  $('bgLeftLabel').textContent = 'Finish Exercise';
  $('bgLeftIcon').textContent = '⇥';
  $('bgRightLabel').textContent = 'Log Set';
  $('bgRightIcon').textContent = '✓';
}

function showTimerCard(target) {
  state.cardMode = 'timer';
  $('swipeCard').dataset.cardMode = 'timer';
  $('setView').classList.remove('is-active');
  $('timerView').classList.add('is-active');
  $('swipeHint').textContent = 'Swipe right to start next · Swipe left to go back';
  $('bgLeftLabel').textContent = 'Previous Set';
  $('bgLeftIcon').textContent = '←';
  $('bgRightLabel').textContent = 'Start Next';
  $('bgRightIcon').textContent = '→';
  updateRestUI(target);
}

function openRestCard(seconds, target) {
  stopRestTimer();
  state.restDuration = seconds;
  state.restRemaining = seconds;
  updatePresetButtons();
  showTimerCard(target);
}

function toggleRestTimer() {
  if (state.cardMode !== 'timer') return;

  if (state.restRunning) {
    stopRestTimer();
    updateRestUI();
    return;
  }

  if (state.restRemaining <= 0) {
    state.restRemaining = state.restDuration;
  }

  state.restRunning = true;
  updateRestUI();

  state.restTimerId = setInterval(() => {
    state.restRemaining -= 1;
    if (state.restRemaining <= 0) {
      stopRestTimer();
      state.restRemaining = 0;
      updateRestUI();
      showToast('Rest complete');
      setTimeout(showSetCard, 450);
      return;
    }
    updateRestUI();
  }, 1000);
}

function adjustRest(delta) {
  if (state.cardMode !== 'timer') return;
  stopRestTimer();
  const next = Math.max(15, Math.min(240, state.restRemaining + delta));
  state.restRemaining = next;
  state.restDuration = next;
  updatePresetButtons();
  updateRestUI();
}

function selectPreset(seconds) {
  if (state.cardMode !== 'timer') return;
  stopRestTimer();
  state.restDuration = seconds;
  state.restRemaining = seconds;
  updatePresetButtons();
  updateRestUI();
}

function recordCurrentSet(extra = {}) {
  state.records[state.exIdx][state.setIdx] = {
    status: 'logged',
    values: { ...state.currentValues },
    ...extra
  };
}

function getTimelineSetState(exIdx, setIdx) {
  const record = getRecord(exIdx, setIdx);
  if (record) return 'logged';
  if (state.workoutDone) return 'pending';
  if (exIdx === state.exIdx && setIdx === state.setIdx) {
    return state.cardMode === 'timer' ? 'upnext' : 'active';
  }
  if (exIdx < state.exIdx || (exIdx === state.exIdx && setIdx < state.setIdx)) {
    return 'missed';
  }
  return 'pending';
}

function renderPrograms() {
  const plan = currentPlan();
  const counts = getCategoryCounts(plan);
  const planList = $('planList');
  planList.innerHTML = '';

  PLANS.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.className = `program-btn${index === state.planIdx ? ' is-active' : ''}`;
    btn.dataset.planIdx = String(index);
    btn.innerHTML = `
      <span class="program-btn-title">${item.name}</span>
      <span class="program-btn-note">${item.audience}</span>
    `;
    planList.appendChild(btn);
  });

  $('programTitle').textContent = plan.name;
  $('programNote').textContent = plan.note;

  const badges = $('programBadges');
  badges.innerHTML = `
    <span class="program-badge">${plan.audience}</span>
    <span class="program-badge">${plan.exercises.length} exercises</span>
    <span class="program-badge">${Object.keys(counts).length} flow types</span>
  `;

  const categoryStrip = $('categoryStrip');
  categoryStrip.innerHTML = '';
  Object.entries(counts).forEach(([key, count]) => {
    const chip = document.createElement('div');
    chip.className = 'category-chip';
    chip.innerHTML = `${CATEGORY_DEFS[key].label}<strong>${count}</strong>`;
    categoryStrip.appendChild(chip);
  });
}

function renderWorkoutView() {
  renderPrograms();

  $('summaryLogged').textContent = String(countLoggedSets());
  $('summaryCurrent').textContent = state.workoutDone ? 'Done' : currentExercise().name;
  $('summaryRemaining').textContent = String(countRemainingSets());

  const timeline = $('timelineList');
  timeline.innerHTML = '';

  currentExercises().forEach((exercise, exIdx) => {
    const group = document.createElement('section');
    group.className = 'timeline-exercise';

    const head = document.createElement('div');
    head.className = 'timeline-exercise-head';
    head.innerHTML = `
      <div class="timeline-exercise-kicker">${CATEGORY_DEFS[exercise.category].label}</div>
      <div class="timeline-exercise-title">${exercise.name}</div>
      <div class="timeline-exercise-note">${state.exerciseNotes[exIdx] || `${exercise.sets.length} sets · ${exercise.rest}s rest · ${CATEGORY_DEFS[exercise.category].summary}`}</div>
    `;
    group.appendChild(head);

    const sets = document.createElement('div');
    sets.className = 'timeline-sets';

    exercise.sets.forEach((set, setIdx) => {
      const stateName = getTimelineSetState(exIdx, setIdx);
      const record = getRecord(exIdx, setIdx);
      const badgeLabel = stateName === 'logged'
        ? 'Logged'
        : stateName === 'active'
          ? 'Live'
          : stateName === 'upnext'
            ? 'Up next'
            : stateName === 'missed'
              ? 'Passed'
              : 'Queued';

      const values = record ? record.values : set.values;
      const meta = summarizeValues(exercise, values);
      const note = record?.note || (stateName === 'upnext' ? 'Rest timer is active for this set.' : '');

      const row = document.createElement('div');
      row.className = `timeline-set is-${stateName}`;
      row.innerHTML = `
        <div class="timeline-marker"></div>
        <div class="timeline-set-main">
          <div class="timeline-set-label">Set ${setIdx + 1}${set.type === 'warmup' ? ' · Warmup' : ''}</div>
          <div class="timeline-set-meta">${meta}</div>
          ${note ? `<div class="timeline-set-note">${note}</div>` : ''}
        </div>
        <div class="timeline-badge is-${stateName}">${badgeLabel}</div>
      `;
      sets.appendChild(row);
    });

    group.appendChild(sets);
    timeline.appendChild(group);
  });
}

function render() {
  renderMetricRows();

  if (state.workoutDone) {
    showSetCard();
    $('exerciseName').textContent = 'Workout complete';
    $('setCounter').textContent = currentPlan().name;
    $('prevExBtn').disabled = true;
    $('nextExBtn').disabled = true;
    $('swipeHint').textContent = 'Switch programs in the workout tab';
    renderWorkoutView();
    updateTabUI();
    return;
  }

  const exercise = currentExercise();
  const set = currentSet();

  $('exerciseName').textContent = exercise.name;
  $('setCounter').textContent = `Set ${state.setIdx + 1} / ${exercise.sets.length}`;
  $('prevExBtn').disabled = state.exIdx === 0;
  $('nextExBtn').disabled = state.exIdx === currentExercises().length - 1;

  updatePresetButtons();
  updateRestUI();
  renderWorkoutView();
  updateTabUI();
}

function advanceToTarget(target) {
  if (!target) {
    state.workoutDone = true;
    render();
    return;
  }

  state.exIdx = target.exIdx;
  state.setIdx = target.setIdx;
  syncInputsFromTarget(target.exIdx, target.setIdx);
  render();
}

function completeLog() {
  const nextTarget = getNextTarget();
  const restSeconds = currentExercise().rest;
  recordCurrentSet();
  showToast(`Logged ${summarizeValues(currentExercise(), state.currentValues)}`);

  if (!nextTarget) {
    state.workoutDone = true;
    render();
    showToast('Workout complete');
    return;
  }

  advanceToTarget(nextTarget);
  openRestCard(restSeconds, nextTarget);
}

function finishExerciseNow() {
  const fromExercise = currentExercise();
  const currentExerciseIndex = state.exIdx;
  const currentSetIndex = state.setIdx;
  const nextExercise = state.exIdx < currentExercises().length - 1 ? getTarget(state.exIdx + 1, 0) : null;

  recordCurrentSet({ note: 'Finished here and advanced to the next exercise.' });
  state.exerciseNotes[currentExerciseIndex] = `Moved on after set ${currentSetIndex + 1}.`;

  if (!nextExercise) {
    state.workoutDone = true;
    render();
    showToast('Workout complete');
    return;
  }

  advanceToTarget(nextExercise);
  showSetCard();
  showToast(`Finished ${fromExercise.name}`);
}

function continueFromTimer() {
  stopRestTimer();
  showSetCard();
}

function goBackFromTimer() {
  const previousTarget = getPreviousTarget();
  if (!previousTarget) {
    continueFromTimer();
    return;
  }

  advanceToTarget(previousTarget);
  showSetCard();
  showToast('Returned to previous set');
}

function resetCard() {
  const card = $('swipeCard');
  card.style.transition = 'none';
  card.style.transform = 'scale(0.9) translateY(36px)';
  $('bgLeft').style.opacity = 0;
  $('bgRight').style.opacity = 0;
  void card.offsetWidth;
  card.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  card.style.transform = 'scale(1) translateY(0)';
}

function onSwipeStart(event) {
  if (state.workoutDone || state.tab !== 'exercise') return;
  if (event.target.closest('.metric-scroller, .rest-core, .rest-step, .preset-btn')) return;

  state.startX = event.type.includes('mouse') ? event.clientX : event.touches[0].clientX;
  state.dragging = true;
  $('swipeCard').classList.add('is-dragging');
  $('swipeCard').style.transition = 'none';
}

function onSwipeMove(event) {
  if (!state.dragging) return;

  const x = event.type.includes('mouse') ? event.clientX : event.touches[0].clientX;
  const deltaX = x - state.startX;
  if (Math.abs(deltaX) < 8) return;

  event.preventDefault();
  state.currentX = deltaX;

  const rotate = deltaX * 0.05;
  $('swipeCard').style.transform = `translateX(${deltaX}px) rotate(${rotate}deg)`;

  const opacity = Math.min(Math.abs(deltaX) / 100, 1);
  if (deltaX > 0) {
    $('bgRight').style.opacity = opacity;
    $('bgLeft').style.opacity = 0;
  } else {
    $('bgLeft').style.opacity = opacity;
    $('bgRight').style.opacity = 0;
  }
}

function onSwipeEnd() {
  if (!state.dragging) return;
  state.dragging = false;

  const card = $('swipeCard');
  card.classList.remove('is-dragging');
  card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

  if (state.currentX > SWIPE_THRESHOLD) {
    card.style.transform = `translateX(${window.innerWidth}px) rotate(20deg)`;
    setTimeout(() => {
      if (state.cardMode === 'timer') {
        continueFromTimer();
      } else {
        completeLog();
      }
      resetCard();
    }, 320);
  } else if (state.currentX < -SWIPE_THRESHOLD) {
    card.style.transform = `translateX(-${window.innerWidth}px) rotate(-20deg)`;
    setTimeout(() => {
      if (state.cardMode === 'timer') {
        goBackFromTimer();
      } else {
        finishExerciseNow();
      }
      resetCard();
    }, 320);
  } else {
    card.style.transform = 'translateX(0) rotate(0)';
    $('bgLeft').style.opacity = 0;
    $('bgRight').style.opacity = 0;
  }

  state.currentX = 0;
}

function resetPlan(planIdx, announce = false) {
  stopRestTimer();
  state.planIdx = planIdx;
  state.exIdx = 0;
  state.setIdx = 0;
  state.workoutDone = false;
  state.records = createEmptyRecords(currentPlan());
  state.exerciseNotes = createEmptyNotes(currentPlan());
  state.restDuration = currentExercise().rest;
  state.restRemaining = currentExercise().rest;
  syncInputsFromTarget(0, 0);
  showSetCard();
  render();

  if (announce) {
    showToast(`Loaded ${currentPlan().name}`);
  }
}

function bindEvents() {
  $('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    updateThemeUI();
  });

  $('exerciseTabBtn').addEventListener('click', () => {
    state.tab = 'exercise';
    updateTabUI();
  });

  $('workoutTabBtn').addEventListener('click', () => {
    state.tab = 'workout';
    renderWorkoutView();
    updateTabUI();
  });

  $('planList').addEventListener('click', event => {
    const btn = event.target.closest('.program-btn');
    if (!btn) return;

    const planIdx = Number(btn.dataset.planIdx);
    if (Number.isNaN(planIdx) || planIdx === state.planIdx) return;
    resetPlan(planIdx, true);
  });

  $('prevExBtn').addEventListener('click', () => {
    if (state.exIdx === 0 || state.workoutDone) return;
    stopRestTimer();
    state.exIdx -= 1;
    state.setIdx = 0;
    syncInputsFromTarget(state.exIdx, state.setIdx);
    showSetCard();
    render();
  });

  $('nextExBtn').addEventListener('click', () => {
    if (state.exIdx >= currentExercises().length - 1 || state.workoutDone) return;
    stopRestTimer();
    state.exIdx += 1;
    state.setIdx = 0;
    syncInputsFromTarget(state.exIdx, state.setIdx);
    showSetCard();
    render();
  });

  $('timerBtn').addEventListener('click', toggleRestTimer);

  document.querySelectorAll('.rest-step').forEach(btn => {
    btn.addEventListener('click', () => adjustRest(Number(btn.dataset.seconds)));
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPreset(Number(btn.dataset.preset)));
  });

  const card = $('swipeCard');
  card.addEventListener('touchstart', onSwipeStart, { passive: false });
  window.addEventListener('touchmove', onSwipeMove, { passive: false });
  window.addEventListener('touchend', onSwipeEnd);

  card.addEventListener('mousedown', onSwipeStart);
  window.addEventListener('mousemove', onSwipeMove);
  window.addEventListener('mouseup', onSwipeEnd);
}

document.addEventListener('DOMContentLoaded', () => {
  updateThemeUI();
  bindEvents();
  resetPlan(0);
});
