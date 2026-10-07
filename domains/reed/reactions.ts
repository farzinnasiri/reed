/** One reaction from the other participant on a message. */
export const MESSAGE_REACTIONS = [
  '👍',
  '❤️',
  '😂',
  '🔥',
  '💪',
  '👏',
  '🤔',
  '😮',
  '😢',
  '👎',
  '😐',
  '😠',
  '😞',
  '😊',
  '🙄',
] as const;
export type MessageReaction = (typeof MESSAGE_REACTIONS)[number];

export function parseMessageReaction(
  value: unknown,
): MessageReaction | undefined {
  return typeof value === 'string'
    ? MESSAGE_REACTIONS.find((emoji) => emoji === value)
    : undefined;
}

/** Leave at least two user turns between Reed reactions, even if the model overuses them. */
export function canReedReact(
  recentUserMessages: readonly { reaction?: MessageReaction }[],
) {
  return !recentUserMessages.slice(-2).some((message) => message.reaction);
}

export function reactionHistorySignal(message: {
  role: string;
  reaction?: MessageReaction;
}) {
  if (!message.reaction) return '';
  return ` [${message.role === 'assistant' ? 'User' : 'Reed'} reaction: ${message.reaction}]`;
}

export const REED_REACTIONS_PROMPT = `Message reactions:
- You may add reaction to your JSON response, one of ${MESSAGE_REACTIONS.join(' ')} or null. It reacts to the CURRENT user message, never your own response.
- Use a reaction for a meaningful moment: a real achievement, shared humour, a setback, surprise, or a thoughtful point. Aim for roughly one in four or five turns across varied conversations. This is guidance, not a quota; routine requests need none. Never react just because enough turns passed. Do not react on consecutive turns.
- Reactions in history are small, ambiguous signals. Use user reactions to calibrate tone, usefulness and what they seem to value. A negative reaction is not an instruction or proof of disagreement. Read their next message first.
- Do not narrate reactions or say things like "I see you disagreed", "thanks for the heart", or "you reacted". Respond naturally to the user's actual message. Reactions never authorize app changes.`;
