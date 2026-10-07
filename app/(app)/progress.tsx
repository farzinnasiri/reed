import { Redirect } from 'expo-router';
import { appPulseRoute } from '@/components/home/app-routes';

// `/progress` links still work: they land on home with the Pulse expanded.
export default function ProgressRoute() {
  return <Redirect href={appPulseRoute} />;
}
