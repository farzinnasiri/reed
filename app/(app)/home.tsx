import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { HomeSurface } from '@/components/home/home-surface';
import { useAppShell } from '@/components/home/app-shell-context';
import { appModeRoutes } from '@/components/home/app-routes';
import { getFirstName, pickHomeGreeting } from '@/components/home/home-greetings';

export default function HomeRoute() {
  const { displayName, hasActiveWorkoutSession } = useAppShell();
  const [currentDayKey, setCurrentDayKey] = useState(() => new Date().toDateString());
  const homeHeadline = useMemo(
    () => pickHomeGreeting(getFirstName(displayName)),
    [currentDayKey, displayName],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const nextDayKey = new Date().toDateString();
      setCurrentDayKey(prev => (prev === nextDayKey ? prev : nextDayKey));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <HomeSurface
      hasActiveSession={hasActiveWorkoutSession}
      homeHeadline={homeHeadline}
      onOpenGoals={() => router.push('/(app)/goals')}
      onOpenWorkout={() => router.push(appModeRoutes.workout)}
    />
  );
}
