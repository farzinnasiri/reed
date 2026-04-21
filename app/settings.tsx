import { Redirect } from 'expo-router';

export default function SettingsScreenRedirect() {
  return <Redirect href={{ pathname: '/', params: { mode: 'settings' } }} />;
}
