export function formatElapsed(startedAt: number, now: number) {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function clampSeconds(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function getErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return 'Something went wrong.';
  }

  // ConvexError passes the developer message as `.data` (a string) when
  // thrown with `throw new ConvexError('...')`. Prefer that over `.message`
  // which wraps it with additional boilerplate text from the Convex client.
  const err = error as Record<string, unknown>;
  if (typeof err.data === 'string' && err.data.length > 0) {
    return err.data;
  }

  if (typeof err.message === 'string' && err.message.length > 0) {
    return err.message;
  }

  return 'Something went wrong.';
}
