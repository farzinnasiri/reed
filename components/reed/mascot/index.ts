// Reed, the mascot, as a drop-in. Import from here; the engine and renderer are internals.
//
//   <ReedMascot expression="happy" size="lg" />                  // fixed expression
//   const reed = useMascot(isBusy ? 'thinking' : 'idle');        // or drive it from state
//   reed.react('happy'); reed.play(['surprised', 'happy']);      // timed, then back to resting
//   reed.play([{ expression: 'effort', speed: 1.8, transition: 'quick' }, 'relieved']);
//   <ReedMascot mascot={reed} size="md" />
//   <ReedMascot expression="sleepy" speed={0.6} transition="slow" />   // fixed face with its own feel
//
// Every face lives in mascot-engine.ts; `npm run mascot:sheet` draws them all.
export { ReedMascot, mascotSizes, type MascotSize } from './reed-mascot';
export { MASCOT_EXPRESSIONS, type MascotExpression } from './mascot-engine';
export { MASCOT_REACTION_MS, resolveMascotTransition, useMascot, type MascotController, type MascotFeel, type MascotStep, type MascotTransition } from './use-mascot';
