import type { ScheduledAlertDefinition } from '@/lib/background-alerts';

export type RestCompleteAlertPayload = {
  exerciseName: string;
  nextSetNumber: number;
};

export const restCompleteAlert: ScheduledAlertDefinition<RestCompleteAlertPayload> = {
  androidChannelId: 'rest-timer-alerts-v4',
  androidChannelName: 'Rest timer alerts',
  foregroundManaged: true,
  sound: 'rest_timer_complete.wav',
  vibrationPattern: [0, 80, 100, 80],
  buildContent: ({ exerciseName, nextSetNumber }) => ({
    body: `${exerciseName} · Set ${nextSetNumber} is ready.`,
    title: 'Rest complete',
  }),
};

export const silentRestCompleteAlert: ScheduledAlertDefinition<RestCompleteAlertPayload> = {
  ...restCompleteAlert,
  androidChannelId: 'rest-timer-alerts-silent-v4',
  androidChannelName: 'Rest timer alerts (silent)',
  sound: null,
};
