// Every line the today greeting can say. Edit freely: the picker in greeting.ts decides when a
// situation applies and mixes these lines; nothing here needs code changes.
//
// Placeholders:
//   {, name}  the name, with its comma, about half the time; dropped otherwise ("Still up{, name}?")
//   {name}    the name, always; the line is skipped for users without one
//   {daypart} morning, afternoon or evening
//   {target}  the weekly active-days goal      {More} / {more}  "Two more active days"
//   {week}    one factual sentence about the week so far
// A line whose placeholder has no value is skipped, never shown half-filled.
//
// Faces: each header can name the face Reed wears while it is said (`face`, one or a list to pick
// from); otherwise the situation's `faces` apply. See MASCOT_EXPRESSIONS for what exists.
//
// Headers sit under the mascot in a large font: keep them to about 28 characters.
// Subheaders may be shown under any header of their situation, so write them about the
// situation, never about one particular header. No guilt, no streak-loss language.

import type { MascotExpression } from '../mascot/mascot-engine';

type Face = MascotExpression | MascotExpression[];

export type Header = {
  text: string;
  emoji?: string;
  /** The mascot's expression while this header is on screen. */
  face?: Face;
  /** A subheader written for this header alone; always shown with it. */
  sub?: string;
  /** Narrow a header to certain weekdays (0 = Sunday) or hours [from, to). */
  days?: number[];
  hours?: [number, number];
};

export type Lines = { headers: Header[]; subs: string[]; faces?: MascotExpression[] };

export const GREETING_COPY = {
  'late-night': {
    faces: ['sleepy', 'concerned'],
    headers: [
      { text: 'Still up{, name}?', face: 'sleepy', emoji: '🌙' },
      { text: 'Night owl hours', face: ['wink', 'sleepy'], emoji: '🦉' },
      { text: "Can't sleep?", face: 'concerned' },
      { text: 'Burning the midnight oil', face: 'focused', emoji: '🕯️' },
    ],
    subs: [
      "Don't worry, sleep is training too.",
      "Whatever's keeping you up, I'm happy to talk it through.",
      "Tomorrow's workout will thank you for going to bed soon.",
      "Just don't start a deadlift PR attempt at this hour.",
    ],
  },
  'early-morning': {
    faces: ['happy', 'idle', 'encouraging'],
    headers: [
      { text: 'Up before the sun', face: 'proud', emoji: '☀️' },
      { text: 'Early bird{, name}', face: 'happy', emoji: '🐦' },
      { text: 'Morning{, name}', face: 'happy' },
      { text: 'The early shift', face: 'ready' },
    ],
    subs: [
      'Show-off. I respect it.',
      'Coffee first, then we sort out the day.',
      'The gym is quiet right now, and so is your inbox.',
      'Whatever you do before 8am, you can feel good about all day.',
    ],
  },
  midday: {
    faces: ['curious', 'happy'],
    headers: [
      { text: 'Lunch break session?', face: 'curious', emoji: '🥪' },
      { text: 'Midday check-in' },
      { text: "How's the day going?" },
    ],
    subs: [
      'Good time to squeeze in a quick one.',
      "Tell me what you've eaten and what you still have planned.",
      'No wrong time to train, really.',
    ],
  },
  afternoon: {
    faces: ['curious', 'idle'],
    headers: [
      { text: 'Afternoon{, name}' },
      { text: "How's the day going?" },
      { text: 'Afternoon slump?', face: 'sleepy', emoji: '🥱' },
    ],
    subs: [
      'The afternoon slump responds well to a walk, in case you were wondering.',
      'Good time to squeeze in a quick one.',
      "Tell me what you've eaten and what you still have planned.",
      'No wrong time to train, really.',
    ],
  },
  evening: {
    faces: ['relieved', 'idle'],
    headers: [
      { text: 'Winding down?', face: 'relieved', emoji: '🌆' },
      { text: 'Evening{, name}' },
      { text: 'End of the day' },
      { text: 'How did today go{, name}?', face: 'curious' },
    ],
    subs: [
      'Stretching counts as training, just saying.',
      "Tell me how it went, or how it didn't.",
      'Still enough time for something light, if you feel like it.',
      'Dinner first. Everything else can wait.',
    ],
  },
  monday: {
    faces: ['encouraging', 'ready'],
    headers: [
      { text: 'Monday, huh', face: 'wink' },
      { text: 'New week{, name}', face: 'encouraging', emoji: '🗓️' },
      { text: 'Fresh week' },
      { text: 'Here we go again', face: 'ready', emoji: '🔁' },
    ],
    subs: [
      "Last week is done. This one's still a blank page.",
      "Let's make it a decent one.",
      'Start small if you have to. A Monday session counts as much as any other.',
      "We don't have to decide the whole week right now.",
    ],
  },
  friday: {
    faces: ['happy', 'wink'],
    headers: [
      { text: "It's Friday", face: ['excited', 'happy'], emoji: '🎉' },
      { text: 'Almost there{, name}' },
      { text: 'Friday energy' },
    ],
    subs: [
      'One more session and the weekend is earned.',
      "What's the plan for the weekend?",
      "Finish the week the way you'd like to remember it.",
    ],
  },
  weekend: {
    faces: ['wink', 'relieved'],
    headers: [
      { text: 'Weekend warrior mode', face: ['wink', 'ready'], emoji: '💪' },
      { text: 'Weekend warrior it is', face: 'wink' },
      { text: 'No alarm clock today?', face: 'sleepy', hours: [5, 12] },
      { text: 'Slow Saturday', face: 'relieved', emoji: '☕', days: [6] },
      { text: 'Sunday{, name}', face: 'relieved', days: [0] },
    ],
    subs: [
      'Whatever you do today counts double. Not officially, but spiritually.',
      'Training, a long walk, or the couch. All valid.',
      "What's the damage this time?",
      'Nowhere to be, so nothing to rush.',
    ],
  },
  'behind-thu-sat': {
    faces: ['encouraging', 'ready'],
    headers: [
      { text: "The week isn't over yet" },
      { text: 'Still some week left' },
      { text: "Plot twist: there's time", face: 'wink' },
    ],
    subs: [
      '{More} and you land right on your goal.',
      "There's still room to get there.",
      'Nothing to catch up on. Just the next session.',
    ],
  },
  'behind-sunday': {
    faces: ['ready', 'encouraging'],
    headers: [
      { text: 'Last call for the week', emoji: '🔔' },
      { text: 'Sunday{, name}' },
    ],
    subs: [
      '{More} and you finish right on target.',
      'Your goal is {target} active days, and I like round numbers. No pressure, though.',
    ],
  },
  'nothing-midweek': {
    faces: ['encouraging', 'curious'],
    headers: [
      { text: 'Day one, take two' },
      { text: 'Fresh start, any time' },
    ],
    subs: [
      "Nothing logged yet this week, and that's okay. Today works as a first day.",
      'Tell me what you did, even if it was just a walk.',
    ],
  },
  'trained-today': {
    faces: ['proud', 'relieved', 'happy'],
    headers: [
      { text: 'Already done for the day', emoji: '✅' },
      { text: 'Look at you{, name}', face: ['wink', 'proud'] },
      { text: "Work's in the bank" },
    ],
    subs: [
      "Go eat something. You've earned a real meal.",
      'The rest of the day is yours.',
      'Want to log how it felt while it\'s fresh?',
    ],
  },
  yesterday: {
    faces: ['curious', 'concerned'],
    headers: [
      { text: "How's the body feeling?", face: 'curious' },
      { text: 'Feeling it today{, name}?', face: 'effort', emoji: '😅' },
    ],
    subs: [
      'Recovery is part of the plan, not a break from it.',
      "If it's rough, a walk and some stretching is a real session too.",
      "Tell me how it feels and we'll decide what today looks like.",
    ],
  },
  'goal-reached': {
    faces: ['proud', 'happy'],
    headers: [
      { text: 'Goal hit{, name}', emoji: '🎯' },
      { text: "Week's handled" },
      { text: "That's the goal" },
    ],
    subs: [
      'Everything from here on is a bonus.',
      "You can rest without feeling guilty. That's the deal.",
      '{target} active days, as promised.',
    ],
  },
  neutral: {
    faces: ['idle', 'happy', 'curious', 'wink'],
    headers: [
      { text: 'Hey {name}' },
      { text: 'Hi{, name}', face: 'happy', emoji: '👋' },
      { text: "What's the plan?" },
      { text: 'Ready when you are', face: ['ready', 'encouraging'] },
      { text: 'What are we working on?', face: 'curious' },
      { text: "What's up?", face: ['curious', 'wink'] },
      { text: 'Good {daypart}{, name}' },
    ],
    subs: [
      "Training, food, sleep, or whatever's on your mind.",
      "Tell me what you did, or what you're about to do.",
      "How's the body today?",
      'We can start anywhere.',
      '{week}',
    ],
  },
} satisfies Record<string, Lines>;

export type SituationId = keyof typeof GREETING_COPY;

/** A couple of percent of opens: complete header and subheader pairs, for the delight of a rare one. */
export const RARE_GREETINGS: Header[] = [
  { text: "Oh, it's you again", face: 'wink', sub: 'Kidding. Always glad to see you.' },
  { text: 'Dumbbell, barbell, or couch?', face: 'curious', sub: 'Decisions, decisions.' },
  { text: 'I was just thinking about you', face: 'wink', sub: "That's a lie. I'm an app. But hi." },
];
