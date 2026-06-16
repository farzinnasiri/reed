import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { posthog } from '@/lib/posthog';

type ClientWideEventValue = string | number | boolean | null | undefined;
type ClientWideEventAttrs = Record<string, ClientWideEventValue>;

const MAX_STRING_LENGTH = 240;
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
        'exception.message': errorMessage(error),
        'exception.slug': slug,
        'exception.type': errorType(error),
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
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    safe[key] = sanitizeValue(value);
  }
  posthog.capture(CLIENT_WIDE_EVENT_NAME, safe);
  void posthog.flush().catch(() => {});
}

function reportClientError(error: unknown, attrs: ClientWideEventAttrs) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || key === 'exception.message') continue;
    safe[key] = sanitizeValue(value);
  }
  safe.handled = true;
  posthog.captureException(error, safe);
}

function sanitizeValue(value: Exclude<ClientWideEventValue, undefined>) {
  if (typeof value !== 'string') return value;
  return value.length <= MAX_STRING_LENGTH ? value : `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorType(error: unknown) {
  return error instanceof Error ? error.name : 'Error';
}
