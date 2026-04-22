const HOME_GREETINGS = [
  '[Name], the bar\'s loaded. What are you waiting for?',
  '[Name], today\'s session won\'t coach itself.',
  'Hey [Name], your body remembers every rep.',
  '[Name], let\'s make today one worth remembering.',
  '[Name], your coach is ready. Are you?',
  'Let\'s get to work, [Name].',
  'No excuses today, [Name]. Just results.',
  'Coach is watching, [Name]. Make it count.',
  'This one\'s for you, [Name].',
  'Eyes forward, [Name]. One rep at a time.',
  'Time to show up for yourself, [Name].',
  'The version of you who doesn\'t quit? That\'s you, [Name].',
  'Every rep is a vote for who you\'re becoming, [Name].',
  'Your future self is counting on you, [Name].',
  'Champions train when no one\'s watching. Go, [Name].',
  'The grind doesn\'t stop. Neither do you, [Name].',
  'Rest days are earned. Today isn\'t one, [Name].',
  'New day. New PR to chase, [Name].',
  'The weights aren\'t going to lift themselves, [Name].',
  'You showed up. That\'s already step one, [Name].',
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
