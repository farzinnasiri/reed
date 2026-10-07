type Target = { metrics: Record<string, number> };

function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100);
}

function formatDuration(seconds: number) {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${Math.round(seconds)} s`;
}

// What one target set asks for, from the metrics a plan can carry. Effort (RPE) and any metric
// this does not know are left out: the capture screen shows the full target when it is logged.
function describeTarget({ metrics }: Target) {
  const reps = metrics.reps ?? metrics.leftReps;
  const duration = metrics.duration ?? metrics.time ?? metrics.leftDuration;
  const parts: string[] = [];

  if (reps !== undefined) parts.push(formatNumber(reps));
  if (duration !== undefined) parts.push(formatDuration(duration));
  if (metrics.distance !== undefined) parts.push(`${formatNumber(metrics.distance)} km`);
  if (metrics.load !== undefined && metrics.load > 0) parts.push(`${formatNumber(metrics.load)} kg`);
  if (metrics.addedLoad !== undefined && metrics.addedLoad > 0) parts.push(`+${formatNumber(metrics.addedLoad)} kg`);
  if (metrics.assistLoad !== undefined && metrics.assistLoad > 0) parts.push(`-${formatNumber(metrics.assistLoad)} kg assist`);

  return parts.join(' · ');
}

/** "3 × 10 · 40 kg": consecutive identical sets are counted, different ones follow each other. */
export function formatTargets(targets: Target[]) {
  const groups: Array<{ count: number; text: string }> = [];

  for (const target of targets) {
    const text = describeTarget(target);
    const last = groups.at(-1);
    if (last && last.text === text) last.count += 1;
    else groups.push({ count: 1, text });
  }

  return groups.map(({ count, text }) => (text ? `${count} × ${text}` : `${count} ${count === 1 ? 'set' : 'sets'}`)).join(', ');
}
