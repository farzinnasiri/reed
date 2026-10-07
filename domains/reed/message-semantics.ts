type Message = {
  role: 'assistant' | 'user';
  source: string;
  status: 'failed' | 'pending' | 'sent';
  completedAt?: number;
  createdAt: number;
};

/** Real replies start pending; preludes are inserted already completed. */
export function isThinkingPrelude(message: Message) {
  return (
    message.role === 'assistant' &&
    message.source === 'system' &&
    message.status === 'sent' &&
    message.completedAt === message.createdAt
  );
}
