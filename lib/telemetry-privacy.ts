type Scalar = string | number | boolean | null | undefined;

// Only technical metadata belongs in operational events. Add fields deliberately here.
const OPERATIONAL_KEYS = new Set([
  'event.kind',
  'event.name',
  'main',
  'service.name',
  'service.environment',
  'service.version',
  'service.build.number',
  'platform.name',
  'duration_ms',
  'error',
  'exception.slug',
  'exception.type',
  'handled',
  'push.platform',
  'push.step',
  'push.status',
  'push.permission.status',
  'screen.name',
  'history.has_cursor',
  'history.row_count',
  'attachment.count',
  'message.has_attachments',
  'message.has_text',
  'message.source',
  'send.step',
  'upload.step',
  'image.compressed.height',
  'image.compressed.width',
  'file.size_bucket',
  'file.type',
  'speech.actor',
  'speech.convex_site_url_present',
  'speech.duration_ms',
  'speech.mime_type',
  'speech.recording_uri_scheme',
  'speech.attempt',
  'speech.attempts',
  'speech.transcript_length_bucket',
  'speech.error_code',
  'speech.retryable',
  'speech.step',
  'speech.audio_size_bucket',
  'speech.upload_transport',
  'startup.phase',
  'fonts_ready_ms',
  'fonts.result',
  'config_ready_ms',
  'config.missing_public_env_count',
  'auth_resolved_ms',
  'auth.state',
  'viewer_resolved_ms',
  'viewer.state',
  'splash_hidden_ms',
  'startup.result',
  'alert.status',
]);

export function safeOperationalAttrs(attrs: Record<string, Scalar>) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (!OPERATIONAL_KEYS.has(key) || value === undefined) continue;
    if (
      value !== null &&
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    )
      continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    safe[key] = typeof value === 'string' ? value.slice(0, 240) : value;
  }
  return safe;
}

export function safeExceptionType(error: unknown) {
  // Error.name is writable and may itself contain user or server content.
  if (error instanceof TypeError) return 'TypeError';
  if (error instanceof RangeError) return 'RangeError';
  if (error instanceof SyntaxError) return 'SyntaxError';
  return 'Error';
}

/** Final SDK boundary also covers automatic uncaught/rejection capture. */
export function sanitizeExceptionCapture<T extends { event: string; properties?: Record<string, unknown> }>(
  event: T | null,
): T | null {
  if (!event || event.event !== '$exception') return event;
  const properties = event.properties ?? {};
  const slug =
    typeof properties['exception.slug'] === 'string' &&
    /^[a-z0-9_.-]{1,120}$/.test(properties['exception.slug'])
      ? properties['exception.slug']
      : 'unhandled_exception';
  const safe = safeOperationalAttrs(properties as Record<string, Scalar>);
  for (const key of [
    '$lib',
    '$lib_version',
    '$os',
    '$os_version',
    '$app_version',
    '$app_build',
    '$device_id',
    '$session_id',
    'distinct_id',
  ]) {
    const value = properties[key];
    if (typeof value === 'string') safe[key] = value;
  }
  return {
    ...event,
    properties: {
      ...safe,
      $exception_level: 'error',
      $exception_list: [
        {
          type: safe['exception.type'] ?? 'Error',
          value: slug,
          mechanism: { type: 'generic', handled: properties.handled === true },
        },
      ],
    },
  };
}
