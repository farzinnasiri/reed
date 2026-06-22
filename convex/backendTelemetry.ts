import type { Id } from './_generated/dataModel';

const MAX_ATTRS = 32;
const MAX_STRING_LENGTH = 240;

type TelemetryAttrs = Record<string, string | number | boolean | null | undefined>;

export async function captureBackendEvent(name: string, attrs: TelemetryAttrs = {}, profileId?: Id<'profiles'>) {
  const token = process.env.POSTHOG_PROJECT_TOKEN;
  if (!token) return;

  const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/capture/`, {
      body: JSON.stringify({
        api_key: token,
        distinct_id: profileId ?? 'reed_backend',
        event: name,
        properties: {
          event_kind: 'operational',
          service_name: 'reed_convex',
          ...(profileId ? { profile_id: profileId } : {}),
          ...sanitizeAttrs(attrs),
        },
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) {
      console.warn('[BACKEND_TELEMETRY_ERROR]', { name, status: response.status });
    }
  } catch (error) {
    console.warn('[BACKEND_TELEMETRY_ERROR]', error instanceof Error ? { message: error.message, name } : { name });
  }
}

function sanitizeAttrs(attrs: TelemetryAttrs) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, value] of Object.entries(attrs).slice(0, MAX_ATTRS)) {
    if (value === undefined) continue;
    const key = rawKey.slice(0, 80);
    safe[key] = typeof value === 'string' && value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`
      : value;
  }
  return safe;
}
