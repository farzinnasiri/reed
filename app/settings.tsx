import { Redirect } from 'expo-router';

// Settings are part of the You sheet; home presents it for `mode=settings` once signed in.
export default function SettingsScreenRedirect() {
  return <Redirect href={{ pathname: '/', params: { mode: 'settings' } }} />;
}
