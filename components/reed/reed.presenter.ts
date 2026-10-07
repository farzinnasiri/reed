export function buildCoachReply(prompt: string, displayName: string) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes('week')) {
    return `${displayName}, look at the week in three parts: what you did, what changed, and what to protect next.`;
  }

  if (normalized.includes('focus')) {
    return 'Next focus: keep the next session narrow. One main lift, one support pattern, no junk volume.';
  }

  if (normalized.includes('progress') || normalized.includes('improving') || normalized.includes('performance')) {
    return 'Progress needs comparison, not mood. Reed should call out the change, the evidence, and the next thing to watch.';
  }

  return 'Good. Keep the question concrete and I’ll keep the answer useful.';
}

export function formatMessageTime(createdAt: number) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Calendar separators use the profile timezone, including midnight and DST boundaries. */
function messageDayKey(at: number, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function formatMessageDate(createdAt: number, timeZone?: string, now = Date.now()) {
  const today = messageDayKey(now, timeZone);
  const day = messageDayKey(createdAt, timeZone);
  if (day === today) return 'Today';
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (day === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return new Date(createdAt).toLocaleDateString([], {
    timeZone, day: 'numeric', month: 'short', year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  });
}

export function isSameMessageDay(left: number, right: number, timeZone?: string) {
  return messageDayKey(left, timeZone) === messageDayKey(right, timeZone);
}
