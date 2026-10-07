/** The device's local calendar day containing `timestamp`, as [startAt, endAt) in UTC milliseconds. */
export function getLocalDayBounds(timestamp: number) {
  const start = new Date(timestamp);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { endAt: end.getTime(), startAt: start.getTime() };
}
