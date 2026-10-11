import type { ReedMessage } from './reed.types';
import * as haptics from '@/design/haptics';
import * as sounds from '@/design/sounds';
const visibleOwners = new Set<symbol>();
export function setConversationFeedbackVisible(owner: symbol, visible: boolean) {
  if (visible) visibleOwners.add(owner); else visibleOwners.delete(owner);
}
export function conversationFailureFeedback() {
  if (visibleOwners.size > 0) haptics.warning();
}

/** Baseline history/offline refreshes; observe completions once across every surface. */
export function createConversationFeedback() {
  let initialized = false;
  let connected = false;
  let since = 0;
  let previous: ReedMessage | undefined;
  let blockedPendingId: string | undefined;
  return (messages: ReedMessage[], ready: boolean, online: boolean) => {
    const latest = messages.findLast(row => row.role === 'assistant' && !row.isAgentThinkingMessage);
    const eligible = ready && online;
    if (!connected && eligible) {
      since = Date.now();
      if (initialized && latest?.status === 'pending') blockedPendingId = latest.id;
    }
    const changed = latest && (latest.id !== previous?.id || latest.status !== previous?.status);
    if (initialized && connected && eligible && changed && latest.createdAt >= (previous?.createdAt ?? 0)
      && latest.id !== blockedPendingId
      && (latest.createdAt >= since || previous?.status === 'pending' && latest.id === previous.id)
      && visibleOwners.size > 0) {
      if (latest.status === 'sent') {
        haptics.reply(latest.serverId ?? latest.id, latest.completedAt);
        sounds.replyArrived(latest.serverId ?? latest.id, latest.completedAt);
      }
      else if (latest.status === 'failed') haptics.replyFailed(latest.serverId ?? latest.id, latest.completedAt);
    }
    if (ready) { previous = latest; initialized = true; }
    connected = eligible;
  };
}
