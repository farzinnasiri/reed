import { roundMetric } from './recipes';

export function formatCompactNumber(value: number, fractionDigits = 1) {
  const rounded = roundMetric(value);
  if (Number.isInteger(rounded)) {
    return Math.round(rounded).toLocaleString('en-US');
  }

  return rounded.toLocaleString('en-US', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}
