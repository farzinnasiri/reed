import { router } from 'expo-router';
import { appModeRoutes } from '@/components/home/app-routes';
import { WorkoutSurface } from '@/components/workout/workout-surface';

export default function WorkoutRoute() {
  return (
    <WorkoutSurface
      onExitWorkout={() => router.replace(appModeRoutes.chat)}
      showStartBackButton={false}
    />
  );
}
