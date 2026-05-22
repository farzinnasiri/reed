import type { ReedTheme } from '@/design/system';
import type { CoachItem, ReedMessage } from './reed.types';

export const QUICK_ACTIONS = [
  'How did this week go?',
  'Next focus',
  'Check my progress',
  'What needs attention?',
] as const;

export const VOICE_WAVEFORM_BARS = [
  { low: 0.52, high: 1.2 },
  { low: 0.84, high: 1.62 },
  { low: 0.62, high: 1.36 },
  { low: 1, high: 1.84 },
  { low: 0.72, high: 1.48 },
  { low: 0.92, high: 1.72 },
  { low: 0.56, high: 1.28 },
  { low: 0.78, high: 1.54 },
  { low: 0.48, high: 1.12 },
] as const;

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

export function resolveQuickActionPrompt(label: string) {
  if (label === 'Next focus') return 'What should I focus on next?';
  if (label === 'Check my progress') return 'Am I improving on my recent training?';
  if (label === 'What needs attention?') return 'What in my training needs attention?';
  return label;
}

export function summarizeCoachItemTitle(text: string) {
  const [firstSentence] = text.split('.');
  const trimmed = firstSentence?.trim() ?? text.trim();
  if (!trimmed) return 'Coach item';
  return trimmed.length > 36 ? `${trimmed.slice(0, 33).trimEnd()}...` : trimmed;
}

export function summarizeReplyQuote(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > 42 ? `${normalized.slice(0, 39).trimEnd()}...` : normalized;
}

export function formatReedLastSeen(lastSeenAt: number, now: number = Date.now()) {
  if (lastSeenAt <= 0) return 'Last seen recently';

  const elapsedMinutes = Math.max(0, Math.floor((now - lastSeenAt) / 60_000));
  if (elapsedMinutes < 1) return 'Last seen just now';
  if (elapsedMinutes === 1) return 'Last seen 1 minute ago';
  if (elapsedMinutes < 60) return `Last seen ${elapsedMinutes} minutes ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours === 1) return 'Last seen 1 hour ago';
  if (elapsedHours < 24) return `Last seen ${elapsedHours} hours ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays === 1) return 'Last seen 1 day ago';
  if (elapsedDays < 7) return `Last seen ${elapsedDays} days ago`;

  const elapsedWeeks = Math.floor(elapsedDays / 7);
  if (elapsedWeeks === 1) return 'Last seen 1 week ago';
  return `Last seen ${elapsedWeeks} weeks ago`;
}

export function getCoachItemColor(theme: ReedTheme, type: CoachItem['type']) {
  if (type === 'caution') return String(theme.colors.dangerText);
  if (type === 'experiment') return String(theme.colors.accentSecondary);
  if (type === 'check_in') return String(theme.colors.successText);
  return String(theme.colors.accentPrimary);
}

export function pickVoiceTranscript(messages: ReedMessage[]) {
  const messageCount = messages.filter(message => message.role === 'user').length;
  if (messageCount === 0) return 'How did this week go?';
  if (messageCount % 2 === 0) return 'What should I focus on next?';
  return 'What changed in my performance?';
}
