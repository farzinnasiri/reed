import { Redirect } from 'expo-router';
import { appYouRoute } from '@/components/home/app-routes';

// `/you` links still work: they land on home with the You sheet presented.
export default function YouRoute() {
  return <Redirect href={appYouRoute} />;
}
