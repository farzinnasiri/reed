const AGENT_THINKING_MESSAGES = [
  'ok, let me have a look.',
  'leave it with me.',
  'give me a sec.',
  'hang on.',
  'one sec.',
  'on it.',
  'let me check.',
  'bear with me.',
  'digging into this.',
  'right, working through it.',
  'let me think about that properly.',
  'just pulling something up.',
  'give me a minute.',
  'ok. 🧠',
  'thinking.',
  'let me look at this.',
  'hold on.',
  'right. one sec.',
  'this needs a second.',
  'looking into it.',
  'got it. give me a minute.',
  'ok, working through this now.',
  'let me work something out.',
  '👀',
  'ok. thinking. 😑',
  'leave it with me. one sec.',
  'checking something.',
  "let me see what we've got here.",
  'hold that thought.',
  '🫠 ok give me a sec.',
];

export function contextAgentGateDecision(message: string): { reason: string; run: boolean } {
  const text = message.toLowerCase();

  if (/\b(recent|history|progress|progressing|improving|plateau|stalled|trend|compare|logged|last session|last workout|what did i do|active goals?|bodyweight|body weight|measurements?)\b/.test(text)) {
    return { reason: 'user asked for app history or stored progress context', run: true };
  }

  if (/\b(what should i (train|do|focus)|build .*session|make .*program|plan|routine|split|next workout|next session|next focus)\b/.test(text)) {
    return { reason: 'user asked for planning that may need goals or training history', run: true };
  }

  if (/\b(can i train|should i train|deload|overtraining|overtrain|recovery|beat up|fatigued|tired from training)\b/.test(text)) {
    return { reason: 'user asked about training readiness or recovery', run: true };
  }

  if (/\b(my|left|right|knee|shoulder|back|elbow|wrist|ankle|hip|neck)\b.*\b(hurts?|pain|ache|sore|annoyed|weird)\b/.test(text)
    || /\b(hurts?|pain|ache|sore|annoyed|weird)\b.*\b(my|left|right|knee|shoulder|back|elbow|wrist|ankle|hip|neck)\b/.test(text)
    || /\bi('m| am| feel| felt| have| had).*\b(hurt|hurting|pain|ache|sore|beat up)\b/.test(text)) {
    return { reason: 'user described a personal pain or recovery issue', run: true };
  }

  if (/\b(stuck|weaker|stronger|pr|personal record)\b/.test(text) && /\b(bench|squat|deadlift|press|row|pull[- ]?up|chin[- ]?up|dip|curl|run|running|cardio|stair climber|muscle[- ]?up|push[- ]?up)\b/.test(text)) {
    return { reason: 'user asked about progress on a specific exercise', run: true };
  }

  return { reason: 'message can be answered without private app-data reads', run: false };
}

export function pickAgentThinkingMessage(seed: string) {
  const index = Math.abs(simpleHash(seed)) % AGENT_THINKING_MESSAGES.length;
  return AGENT_THINKING_MESSAGES[index];
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return hash;
}
