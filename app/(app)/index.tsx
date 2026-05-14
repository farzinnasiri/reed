import { Redirect } from 'expo-router';
import { appModeRoutes } from '@/components/home/app-routes';

export default function AppIndexRoute() {
  return <Redirect href={appModeRoutes.workout} />;
}
