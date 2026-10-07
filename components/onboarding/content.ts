import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

// Onboarding taxonomy and copy. Completed answers feed Reed’s coaching context.
//
// Taxonomy rule: a world is the top level, a discipline is something you would say "I do ___"
// about. Skills (handstands, a first muscle-up) never appear as choices; at most they are a hint.

type IconName = ComponentProps<typeof Ionicons>['name'];

export type CategoryId = 'dance' | 'snow' | 'water' | 'climb' | 'wheels' | 'run' | 'movement' | 'strength' | 'combat' | 'team';

export type Discipline = { label: string; hint?: string };

export type Category = {
  id: CategoryId;
  label: string;
  tagline: string;
  /** Reed's question on this world's screen. */
  prompt: string;
  icon: IconName;
  disciplines: Discipline[];
  /** What the practice asks of the body: the seed of the support work Reed builds. */
  asks: string[];
};

export const CATEGORIES: Category[] = [
  {
    id: 'dance',
    label: 'Dance',
    tagline: 'Social, stage or studio',
    prompt: 'Which dances are yours?',
    icon: 'musical-notes',
    disciplines: [
      { label: 'Salsa' }, { label: 'Bachata' }, { label: 'Kizomba' }, { label: 'Hip-hop' }, { label: 'Breaking' },
      { label: 'Contemporary' }, { label: 'Ballet' }, { label: 'Ballroom' }, { label: 'Swing' }, { label: 'Pole & aerial' },
    ],
    asks: ['Ankle and calf resilience', 'Hip mobility and control', 'Balance for spins and turns'],
  },
  {
    id: 'snow',
    label: 'Snow',
    tagline: 'Boards and skis',
    prompt: 'What do you ride or ski?',
    icon: 'snow',
    disciplines: [{ label: 'Snowboarding' }, { label: 'Skiing' }, { label: 'Ski touring' }, { label: 'Cross-country' }],
    asks: ['Quad and knee durability', 'Core and balance', 'Landing and impact prep'],
  },
  {
    id: 'water',
    label: 'Water',
    tagline: 'Wake, surf, swim, paddle',
    prompt: 'What do you do on the water?',
    icon: 'water',
    disciplines: [
      { label: 'Wakeboarding' }, { label: 'Surfing' }, { label: 'Kitesurfing' }, { label: 'Water skiing' },
      { label: 'Swimming' }, { label: 'Paddling' }, { label: 'Rowing' },
    ],
    asks: ['Grip and forearm endurance', 'Shoulder health', 'Core strength for landings'],
  },
  {
    id: 'climb',
    label: 'Climbing',
    tagline: 'Rock, bouldering, big days',
    prompt: 'What do you climb or walk up?',
    icon: 'trail-sign',
    disciplines: [
      { label: 'Bouldering' }, { label: 'Sport climbing' }, { label: 'Trad climbing' }, { label: 'Hiking' },
      { label: 'Mountaineering' }, { label: 'Via ferrata' },
    ],
    asks: ['Finger and pulling strength', 'Shoulder and elbow health', 'An aerobic base for long days'],
  },
  {
    id: 'wheels',
    label: 'Wheels',
    tagline: 'Road, trail, park',
    prompt: 'What do you ride?',
    icon: 'bicycle',
    disciplines: [{ label: 'Road cycling' }, { label: 'Mountain biking' }, { label: 'BMX' }, { label: 'Skateboarding' }, { label: 'Roller & inline' }],
    asks: ['Leg strength and aerobic engine', 'Hip and back comfort', 'Wrist and shoulder resilience'],
  },
  {
    id: 'run',
    label: 'Running',
    tagline: 'Distance, trail, races',
    prompt: 'How do you run?',
    icon: 'footsteps',
    disciplines: [{ label: 'Road running' }, { label: 'Trail running' }, { label: 'Triathlon' }, { label: 'Hyrox & obstacle' }],
    asks: ['An aerobic base', 'Calf, foot and shin durability', 'Hip and glute strength'],
  },
  {
    id: 'movement',
    label: 'Movement',
    tagline: 'Bodyweight, yoga, flow',
    prompt: 'How do you move?',
    icon: 'body',
    disciplines: [
      { label: 'Calisthenics' },
      { label: 'Gymnastics' }, { label: 'Parkour' }, { label: 'Yoga' }, { label: 'Pilates' }, { label: 'Acro' },
    ],
    asks: ['Pulling and pushing strength', 'Wrist and shoulder prep', 'Body control and positions'],
  },
  {
    id: 'strength',
    label: 'Strength',
    tagline: 'Lifting, for itself',
    prompt: 'How do you lift?',
    icon: 'barbell',
    disciplines: [{ label: 'Bodybuilding' }, { label: 'Powerlifting' }, { label: 'Olympic lifting' }, { label: 'CrossFit' }, { label: 'General strength' }],
    asks: ['Progressive loading', 'Recovery between sessions', 'Joint upkeep'],
  },
  {
    id: 'combat',
    label: 'Combat',
    tagline: 'Striking and grappling',
    prompt: 'What do you fight?',
    icon: 'fitness',
    disciplines: [{ label: 'Boxing' }, { label: 'BJJ' }, { label: 'Muay Thai' }, { label: 'Wrestling' }, { label: 'MMA' }, { label: 'Judo' }],
    asks: ['Neck and grip', 'Conditioning for rounds', 'Hip and shoulder mobility'],
  },
  {
    id: 'team',
    label: 'Team sports',
    tagline: 'Ball sports and courts',
    prompt: 'What do you play?',
    icon: 'basketball',
    disciplines: [
      { label: 'Football' }, { label: 'Basketball' }, { label: 'Tennis' }, { label: 'Padel' },
      { label: 'Volleyball' }, { label: 'Hockey' }, { label: 'Rugby' },
    ],
    asks: ['Speed and change of direction', 'Knee and ankle durability', 'Repeat-effort conditioning'],
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(category => [category.id, category])) as Record<CategoryId, Category>;

/** How deep someone is in an activity. Tapping a tile climbs these, then clears. */
export const LEVELS = ['For fun', 'Into it', 'Serious', 'Pro'] as const;

export const WORLD_REACTIONS: Record<CategoryId, string> = {
  dance: 'Dancers move like no one else.',
  snow: 'Snow people. I like you already.',
  water: 'Water. Nice.',
  climb: 'Up we go.',
  wheels: 'Wheels. Good.',
  run: 'Miles. Respect.',
  movement: 'Moving your own weight. Love that.',
  strength: 'Iron has its place.',
  combat: "Noted. I'll keep you in one piece.",
  team: 'Team player. Good.',
};

export function levelReaction(label: string, level: number) {
  switch (level) {
    case 1: return `${label}, for fun. Love that.`;
    case 2: return `${label}, getting into it.`;
    case 3: return `${label}, seriously. Noted.`;
    default: return `${label} at pro level. I see you.`;
  }
}

export const SEX_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'private' },
] as const;
export type Sex = (typeof SEX_OPTIONS)[number]['value'];

export const SLEEP_OPTIONS = [
  { big: '<6', label: 'Under 6 hours' },
  { big: '6–7', label: '6 to 7 hours' },
  { big: '7–8', label: '7 to 8 hours' },
  { big: '8+', label: '8 hours or more' },
] as const;

export const DAY_LOAD_OPTIONS = [
  { id: 'sitting', icon: 'laptop', title: 'Mostly sitting', subtitle: 'Desk, car, couch' },
  { id: 'feet', icon: 'walk', title: 'On my feet', subtitle: 'Walking and standing a lot' },
  { id: 'physical', icon: 'hammer', title: 'Physical work', subtitle: 'Lifting, carrying, labour' },
  { id: 'varies', icon: 'shuffle', title: 'It varies', subtitle: 'No two days alike' },
] as const;

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type DayState = 'free' | 'fixed' | 'off';

export const RHYTHMS = [
  { id: 'plan', icon: 'list', title: 'Give me a plan', subtitle: 'A clear structure, and I hold you to it.' },
  { id: 'rotate', icon: 'repeat', title: 'Rotate my focus', subtitle: 'I go deep on one thing for a stretch, then switch.' },
  { id: 'daily', icon: 'sunny', title: 'Day by day', subtitle: 'Tell me what today should be.' },
] as const satisfies readonly { id: string; icon: IconName; title: string; subtitle: string }[];

export const BLOCK_WEEKS = [
  { label: '1 wk', value: '1' },
  { label: '2 wks', value: '2' },
  { label: '3 wks', value: '3' },
  { label: '4 wks', value: '4' },
] as const;

export const PUSH_OPTIONS = [
  { id: 0, icon: 'leaf', title: 'Ease me in', subtitle: 'Gentle at first. I build trust before intensity.' },
  { id: 1, icon: 'speedometer', title: 'Steady', subtitle: 'Honest progress, no heroics.' },
  { id: 2, icon: 'flame', title: 'Push me', subtitle: "Hold me to it. I'd rather be challenged." },
] as const satisfies readonly { id: number; icon: IconName; title: string; subtitle: string }[];

export const SYNTH_LINES = [
  'Reading your world',
  'Matching it to what each practice asks of your body',
  'Choosing where to start',
];

/** Body-shape cards: ranges are approximate body fat, shown under the picture. */
export const BODY_SHAPES = [
  { value: 'very_lean', label: 'Very lean', fat: { female: '16–19%', male: '8–11%' } },
  { value: 'lean', label: 'Lean', fat: { female: '20–23%', male: '12–15%' } },
  { value: 'average_lean', label: 'Average lean', fat: { female: '24–27%', male: '16–19%' } },
  { value: 'soft_middle', label: 'Soft middle', fat: { female: '28–31%', male: '20–23%' } },
  { value: 'average', label: 'Average', fat: { female: '32–35%', male: '24–27%' } },
  { value: 'high_fat', label: 'Higher body fat', fat: { female: '36–40%', male: '28–32%' } },
  { value: 'larger_high_fat', label: 'Larger frame', fat: { female: '41–46%', male: '33–38%' } },
  { value: 'muscular_solid', label: 'Muscular, solid', fat: { female: '24–30%', male: '16–22%' } },
  { value: 'athletic_muscular', label: 'Athletic, muscular', fat: { female: '18–23%', male: '10–15%' } },
] as const;
export type BodyShape = (typeof BODY_SHAPES)[number]['value'];

export const BODY_SHAPE_IMAGES = {
  female: {
    athletic_muscular: require('../../assets/images/onboarding/body-types/female/athletic-muscular.webp'),
    average: require('../../assets/images/onboarding/body-types/female/average.webp'),
    average_lean: require('../../assets/images/onboarding/body-types/female/average-lean.webp'),
    high_fat: require('../../assets/images/onboarding/body-types/female/high-fat.webp'),
    larger_high_fat: require('../../assets/images/onboarding/body-types/female/larger-high-fat.webp'),
    lean: require('../../assets/images/onboarding/body-types/female/lean.webp'),
    muscular_solid: require('../../assets/images/onboarding/body-types/female/muscular-solid.webp'),
    soft_middle: require('../../assets/images/onboarding/body-types/female/soft-middle.webp'),
    very_lean: require('../../assets/images/onboarding/body-types/female/very-lean.webp'),
  },
  male: {
    athletic_muscular: require('../../assets/images/onboarding/body-types/male/athletic-muscular.webp'),
    average: require('../../assets/images/onboarding/body-types/male/average.webp'),
    average_lean: require('../../assets/images/onboarding/body-types/male/average-lean.webp'),
    high_fat: require('../../assets/images/onboarding/body-types/male/high-fat.webp'),
    larger_high_fat: require('../../assets/images/onboarding/body-types/male/larger-high-fat.webp'),
    lean: require('../../assets/images/onboarding/body-types/male/lean.webp'),
    muscular_solid: require('../../assets/images/onboarding/body-types/male/muscular-solid.webp'),
    soft_middle: require('../../assets/images/onboarding/body-types/male/soft-middle.webp'),
    very_lean: require('../../assets/images/onboarding/body-types/male/very-lean.webp'),
  },
} as const;

/** What drifts past on the welcome screen: the range of things Reed coaches, not just lifting. */
export const MARQUEE_ROWS: { icon: IconName; label: string }[][] = [
  [
    { icon: 'musical-notes', label: 'Salsa' }, { icon: 'snow', label: 'Snowboarding' }, { icon: 'trail-sign', label: 'Bouldering' },
    { icon: 'water', label: 'Wakeboarding' }, { icon: 'body', label: 'Calisthenics' }, { icon: 'bicycle', label: 'Mountain biking' },
    { icon: 'musical-notes', label: 'Hip-hop' }, { icon: 'footsteps', label: 'Trail running' },
  ],
  [
    { icon: 'water', label: 'Surfing' }, { icon: 'musical-notes', label: 'Bachata' }, { icon: 'fitness', label: 'Muay Thai' },
    { icon: 'trail-sign', label: 'Hiking' }, { icon: 'body', label: 'Yoga' }, { icon: 'snow', label: 'Skiing' },
    { icon: 'bicycle', label: 'Skateboarding' }, { icon: 'barbell', label: 'Lifting' },
  ],
];

/** The welcome screen's rotating promises, each with the face Reed makes saying it. */
export const WELCOME_FEATURES = [
  { icon: 'calendar', text: 'Plans around your real week', face: 'happy' },
  { icon: 'repeat', text: 'Rotates your focus the way you do', face: 'encouraging' },
  { icon: 'body', text: 'Looks after your knees, shoulders and ankles', face: 'concerned' },
  { icon: 'musical-notes', text: 'Knows a salsa night from a leg day', face: 'excited' },
  { icon: 'chatbubble-ellipses', text: "Honest with you, even when it's strict", face: 'proud' },
] as const satisfies readonly { icon: IconName; text: string; face: string }[];
