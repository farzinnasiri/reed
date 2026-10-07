import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { posthog } from '@/lib/posthog';
import { safeExceptionType, safeOperationalAttrs } from '@/lib/telemetry-privacy';

type ClientWideEventValue = string | number | boolean | null | undefined;
type ClientWideEventAttrs = Record<string, ClientWideEventValue>;

const CLIENT_WIDE_EVENT_NAME = 'client_wide_event';

export type ClientWideEvent = {
  end: (attrs?: ClientWideEventAttrs) => void;
  fail: (error: unknown, slug: string, attrs?: ClientWideEventAttrs) => void;
  set: (attrs: ClientWideEventAttrs) => void;
};

export function startClientWideEvent(name: string, initialAttrs: ClientWideEventAttrs = {}): ClientWideEvent {
  const startedAt = Date.now();
  const attrs: ClientWideEventAttrs = {
    'event.kind': 'operational',
    'event.name': name,
    'main': true,
    'service.name': 'reed_expo_app',
    'service.environment': __DEV__ ? 'development' : 'production',
    'service.version': Constants.expoConfig?.version ?? 'unknown',
    'service.build.number': Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? 'unknown',
    'platform.name': Platform.OS,
    ...initialAttrs,
  };
  let ended = false;

  return {
    end(finalAttrs = {}) {
      if (ended) return;
      ended = true;
      captureClientWideEvent({
        ...attrs,
        ...finalAttrs,
        'duration_ms': Date.now() - startedAt,
        'error': attrs.error ?? false,
      });
    },

    fail(error, slug, finalAttrs = {}) {
      if (ended) return;
      ended = true;
      const errorAttrs = {
        ...attrs,
        ...finalAttrs,
        'duration_ms': Date.now() - startedAt,
        'error': true,
        'exception.slug': slug,
        'exception.type': safeExceptionType(error),
      };
      captureClientWideEvent(errorAttrs);
      reportClientError(error, errorAttrs);
    },

    set(nextAttrs) {
      Object.assign(attrs, nextAttrs);
    },
  };
}

export function sizeBucket(bytes: number | undefined) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 100 * 1024) return 'lt_100kb';
  if (bytes < 1024 * 1024) return '100kb_1mb';
  if (bytes < 5 * 1024 * 1024) return '1mb_5mb';
  if (bytes < 10 * 1024 * 1024) return '5mb_10mb';
  return 'gt_10mb';
}

function captureClientWideEvent(attrs: ClientWideEventAttrs) {
  const safe = safeOperationalAttrs(attrs);
  posthog.capture(CLIENT_WIDE_EVENT_NAME, safe);
  void posthog.flush().catch(() => {});
}

function reportClientError(error: unknown, attrs: ClientWideEventAttrs) {
  const safe = safeOperationalAttrs(attrs);
  safe.handled = true;
  const exception = new Error(String(safe['exception.slug'] ?? 'handled_exception'));
  exception.name = safeExceptionType(error);
  posthog.captureException(exception, safe);
}
