const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight of the Monday that starts the week containing `timestamp`, on this device's clock. */
export function weekStart(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  const sinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - sinceMonday);
  return date.getTime();
}

function weekLabel(start: number, now: number) {
  const thisWeek = weekStart(now);
  if (start === thisWeek) return 'This week';
  if (start === weekStart(thisWeek - DAY_MS)) return 'Last week';
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const first = new Date(start);
  const month = (date: Date) => new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
  return first.getMonth() === end.getMonth()
    ? `${month(first)} ${first.getDate()}–${end.getDate()}`
    : `${month(first)} ${first.getDate()} – ${month(end)} ${end.getDate()}`;
}

/** Sessions newest first, grouped under "This week", "Last week", then the week's own dates. */
export function groupByWeek<T extends { startedAt: number }>(items: T[], now: number) {
  const groups: { key: number; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = weekStart(item.startedAt);
    const group = groups.at(-1);
    if (group?.key === key) group.items.push(item);
    else groups.push({ key, label: weekLabel(key, now), items: [item] });
  }
  return groups;
}

/** Sets logged on each day of the week starting at `start` (Monday first), for a week's bars. */
export function weekDayLoads(items: { startedAt: number; sets: number }[], start: number) {
  const loads = Array.from({ length: 7 }, () => 0);
  for (const item of items) {
    const day = Math.floor((new Date(item.startedAt).setHours(0, 0, 0, 0) - start) / DAY_MS + 0.5);
    if (day >= 0 && day < 7) loads[day] += item.sets;
  }
  return loads;
}
