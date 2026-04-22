const HOME_GREETINGS = [
  'Ready to add a few honest reps?',
  'A small session still counts.',
  'Momentum beats motivation today.',
  'Go lift something heavier than your excuses.',
  'Keep it simple. Show up and log it.',
  'Your timeline is waiting for fresh data.',
  'Strong weeks are built one session at a time.',
  'No drama. Just good work.',
  'One more session and the week looks different.',
  'If today is chaos, make the workout clear.',
  'Reed is ready when you are.',
  'Let the app count. You just move.',
] as const;

export function pickHomeGreeting() {
  const index = Math.floor(Math.random() * HOME_GREETINGS.length);
  return HOME_GREETINGS[index] ?? HOME_GREETINGS[0];
}

export function getFirstName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return 'there';
  }

  return trimmed.split(/\s+/)[0] ?? 'there';
}
