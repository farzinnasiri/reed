/**
 * A critically damped spring (no bounce) with a perceptual duration, the way SwiftUI defines it:
 * stiffness (2π / duration)², damping 2·√stiffness. This is `{ dampingRatio: 1, duration }` as
 * plain physics, for libraries that take stiffness and damping, not a duration.
 */
export function criticalSpring(durationMs: number) {
  const stiffness = (2 * Math.PI / (durationMs / 1000)) ** 2;
  return { damping: 2 * Math.sqrt(stiffness), mass: 1, stiffness } as const;
}
