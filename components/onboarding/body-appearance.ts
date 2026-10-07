import { reedBodyMetrics } from '@/design/system';
import type { BodyShape } from './content';

// Relative appearances, not a numeric body-fat estimator. The authored endpoints
// have a limited range; the two larger choices share its fullest endpoint.
const FULLNESS: Record<BodyShape, number> = {
  very_lean: 0, lean: .2, average_lean: .4, soft_middle: .6,
  average: .8, high_fat: 1, larger_high_fat: 1,
  muscular_solid: .4, athletic_muscular: .2,
};

export function onboardingAppearance(shape: BodyShape | null) {
  return { adiposity: shape === null ? reedBodyMetrics.defaultAdiposity : FULLNESS[shape], muscularity: 1 };
}
