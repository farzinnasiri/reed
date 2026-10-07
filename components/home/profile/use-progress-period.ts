import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { getProfilePeriodRange, type ProfilePeriod } from '@/domains/trainingKnowledge/progress-periods';
import { FIVE_MINUTE_BUCKET_MS, useFiveMinuteNow } from '../use-five-minute-now';

export function useProgressPeriod(period: ProfilePeriod) {
  const now = useFiveMinuteNow();
  const viewer = useQuery(api.profiles.viewer, {});
  const timeZone = viewer?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useMemo(() => getProfilePeriodRange(period, now, timeZone, FIVE_MINUTE_BUCKET_MS), [now, period, timeZone]);
}
