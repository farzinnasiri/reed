import type Ionicons from '@expo/vector-icons/Ionicons';
import { createSeededRandom } from './seeded-random';

type Intent = 'planning' | 'reflection' | 'recovery' | 'checkin' | 'technique';
export type HomeSuggestion = { id: string; label: string; prompt: string; icon: keyof typeof Ionicons.glyphMap; intent: Intent };
export type SuggestionContext = {
  hour: number;
  weekday: number;
  activeSession: boolean;
  trainedToday: boolean;
  activeDays: number;
  targetDays: number | null;
  hasTrainingHistory: boolean;
  hasGoal: boolean;
};

export const HOME_SUGGESTIONS: HomeSuggestion[] = [
  { id: 'plan-today', label: 'Plan today', icon: 'calendar-outline', intent: 'planning', prompt: 'Help me choose what to train today, based on my recent activity, recovery and available time. Ask if anything important is missing.' },
  { id: 'next-focus', label: 'Next focus', icon: 'compass-outline', intent: 'planning', prompt: 'What should I focus on next?' },
  { id: 'week-review', label: 'Review my week', icon: 'calendar-number-outline', intent: 'reflection', prompt: 'How did this week go?' },
  { id: 'check-progress', label: 'My progress', icon: 'trending-up-outline', intent: 'reflection', prompt: 'Am I improving on my recent training?' },
  { id: 'check-in', label: 'Check in', icon: 'chatbubble-ellipses-outline', intent: 'checkin', prompt: 'Help me check in with my energy, mood and how my body feels before deciding what to do.' },
  { id: 'recovery', label: 'Recover well', icon: 'battery-charging-outline', intent: 'recovery', prompt: 'Given my recent activity, what would help my recovery today? Ask how I feel before assuming I need rest.' },
  { id: 'wind-down', label: 'Wind down', icon: 'moon-outline', intent: 'recovery', prompt: 'Help me wind down this evening and get ready for tomorrow. Keep it simple and suited to my recent activity.' },
  { id: 'short-session', label: 'Short session', icon: 'timer-outline', intent: 'planning', prompt: 'I have limited time. Help me find a short, useful session for today. Ask how much time and what equipment I have.' },
  { id: 'technique', label: 'Technique help', icon: 'body-outline', intent: 'technique', prompt: 'Help me improve technique in one of my practices. Ask which movement or skill I want to work on.' },
  { id: 'balance-week', label: 'Balance my week', icon: 'grid-outline', intent: 'planning', prompt: 'Help me balance the rest of my week across my practices, recent training and recovery.' },
  { id: 'restart', label: 'Get going', icon: 'refresh-outline', intent: 'checkin', prompt: 'Help me get going with a manageable first session this week, based on what I enjoy and how I feel.' },
  { id: 'goal-check', label: 'Check my goal', icon: 'flag-outline', intent: 'reflection', prompt: 'Review my active goal and help me choose a useful next step from my actual progress.' },
  { id: 'workout-focus', label: 'Workout focus', icon: 'barbell-outline', intent: 'planning', prompt: 'Help me focus on the workout I have open. Use its current state and ask what I need help with.' },
];

function weight(item: HomeSuggestion, context: SuggestionContext) {
  const { hour, weekday, activeDays, activeSession, trainedToday, hasTrainingHistory, hasGoal, targetDays } = context;
  const evening = hour >= 18 || hour < 5;
  switch (item.id) {
    case 'week-review': return activeDays > 0 ? weekday === 0 || weekday >= 5 ? 10 : 3 : 0;
    case 'check-progress': return hasTrainingHistory ? 4 : 0;
    case 'goal-check': return hasGoal ? 5 : 0;
    case 'workout-focus': return activeSession ? 12 : 0;
    case 'plan-today': return activeSession || trainedToday ? 0 : evening ? 2 : 9;
    case 'next-focus': return activeSession ? 0 : trainedToday ? 3 : 6;
    case 'short-session': return activeSession || trainedToday ? 0 : evening ? 3 : 5;
    case 'balance-week': return activeSession ? 0 : weekday >= 1 && weekday <= 4 ? 5 : 2;
    case 'restart': return activeSession || activeDays > 0 ? 0 : 7;
    case 'recovery': return trainedToday || targetDays !== null && activeDays >= targetDays ? 10 : hasTrainingHistory ? 4 : 2;
    case 'wind-down': return evening ? 10 : 0;
    case 'technique': return activeSession ? 7 : 3;
    default: return 5;
  }
}

// A seeded weighted draw: relevance wins over variety, and unrelated renders never reshuffle it.
// Keep at least three different intents among the four choices.
export function selectHomeSuggestions(context: SuggestionContext, seed: number): HomeSuggestion[] {
  const random = createSeededRandom(seed);
  const ranked = HOME_SUGGESTIONS.map(item => {
    const relevance = weight(item, context);
    return { item, relevance, rank: -Math.log(Math.max(Number.EPSILON, random())) / Math.max(relevance, Number.EPSILON) };
  }).filter(item => item.relevance > 0).sort((a, b) => a.rank - b.rank);
  const result: HomeSuggestion[] = [];
  const intents = new Map<Intent, number>();
  for (const { item } of ranked) {
    const count = intents.get(item.intent) ?? 0;
    if (count >= 2 || result.length === 3 && intents.size < 3 && count > 0) continue;
    result.push(item);
    intents.set(item.intent, count + 1);
    if (result.length === 4) break;
  }
  return result;
}
