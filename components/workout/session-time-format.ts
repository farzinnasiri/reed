/** "1h 5m", "52m", "45s": seconds as the short length a stat or button has room for. */
export function formatCompactDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h${minutes ? ` ${minutes}m` : ''}` : `${minutes}m`;
}

/** "11:42 AM" in the device's locale. */
export function formatClockTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}
