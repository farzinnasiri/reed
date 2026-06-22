import * as SplashScreen from 'expo-splash-screen';
import { startClientWideEvent } from '@/lib/client-observability';

type StartupViewer = { onboardingCompletedAt?: number } | null;

const startupStartedAt = Date.now();
const startupEvent = startClientWideEvent('app_startup', {
  'startup.phase': 'module_loaded',
});
let hasEndedStartupEvent = false;

export function markStartupFontsReady(hasError: boolean) {
  startupEvent.set({
    'fonts_ready_ms': startupElapsedMs(),
    'fonts.result': hasError ? 'error' : 'loaded',
  });
}

export function markStartupConfigReady(missingPublicEnvCount: number) {
  startupEvent.set({
    'config_ready_ms': startupElapsedMs(),
    'config.missing_public_env_count': missingPublicEnvCount,
  });
}

export function markStartupAuthReady(session: unknown | null | undefined) {
  startupEvent.set({
    'auth_resolved_ms': startupElapsedMs(),
    'auth.state': session ? 'signed_in' : 'signed_out',
  });
}

export function markStartupViewerReady(session: unknown | null | undefined, viewer: StartupViewer) {
  startupEvent.set({
    'viewer_resolved_ms': startupElapsedMs(),
    'viewer.state': getStartupViewerState(session, viewer),
  });
}

export function hideSplashAndEndStartup(
  result: string,
  attrs: Record<string, string | number | boolean | null> = {},
) {
  SplashScreen.hideAsync()
    .catch(() => {})
    .finally(() => {
      if (hasEndedStartupEvent) {
        return;
      }

      hasEndedStartupEvent = true;
      startupEvent.end({
        ...attrs,
        'splash_hidden_ms': startupElapsedMs(),
        'startup.result': result,
      });
    });
}

export function getStartupResult(session: unknown | null | undefined, viewer: StartupViewer | undefined) {
  if (!session) {
    return 'signed_out';
  }

  if (!viewer) {
    return 'profile_missing';
  }

  return viewer.onboardingCompletedAt ? 'app_ready' : 'onboarding';
}

export function getStartupViewerState(session: unknown | null | undefined, viewer: StartupViewer | undefined) {
  if (!session) {
    return 'skipped';
  }

  if (viewer === undefined) {
    return 'pending';
  }

  if (viewer === null) {
    return 'missing';
  }

  return viewer.onboardingCompletedAt ? 'ready' : 'needs_onboarding';
}

function startupElapsedMs() {
  return Date.now() - startupStartedAt;
}
