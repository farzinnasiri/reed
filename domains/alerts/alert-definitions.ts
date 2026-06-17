import type { ScheduledAlertDefinition } from '@/lib/background-alerts';

const REST_TIMER_CUE = require('../../assets/sounds/rest_timer_complete.wav');

export type RestCompleteAlertPayload = {
  exerciseName: string;
  nextSetNumber: number;
};

export const restCompleteAlert: ScheduledAlertDefinition<RestCompleteAlertPayload> = {
  androidChannelId: 'rest-timer-alerts-v3',
  androidChannelName: 'Rest timer alerts',
  foregroundSound: REST_TIMER_CUE,
  sound: 'rest_timer_complete.wav',
  vibrationPattern: [0, 250, 200, 250],
  buildContent: ({ exerciseName, nextSetNumber }) => ({
    body: `${exerciseName} · Set ${nextSetNumber} is ready.`,
    title: 'Rest complete',
  }),
};
