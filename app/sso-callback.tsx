import { BootSplash } from '@/components/launch/boot-splash';

// Native SSO resumes its pending browser session with the rotating token nonce.
// Keep this URL intact until the native hook finishes. Web uses the .web callback.
export default function SsoCallback() {
  return <BootSplash />;
}
