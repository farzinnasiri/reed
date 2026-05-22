import { router } from 'expo-router';
import { GoalsPageSurface } from '@/components/home/goals-page-surface';

export default function GoalsRoute() {
  return <GoalsPageSurface onBack={() => router.back()} />;
}
