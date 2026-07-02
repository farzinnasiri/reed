const HOME_GREETINGS = [
  '[Name], your coach is ready. Are you?',
  'Let\'s get to work, [Name].',
  'No excuses today, [Name].',
  'This one\'s for you, [Name].',
  'Eyes forward, [Name].',
  'Show up today, [Name].',
  'New day. New PR, [Name].',
  'You showed up, [Name].',
] as const;

export function pickHomeGreeting(firstName: string) {
  const index = Math.floor(Math.random() * HOME_GREETINGS.length);
  const template = HOME_GREETINGS[index] ?? HOME_GREETINGS[0];
  return template.replaceAll('[Name]', firstName);
}

export function getFirstName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return 'there';
  }

  return trimmed.split(/\s+/)[0] ?? 'there';
}
