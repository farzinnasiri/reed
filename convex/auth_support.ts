const defaultTrustedOrigins = ['reed://'];
const localTrustedOrigins = buildLocalTrustedOrigins();

function getAuthBaseUrl() {
  return process.env.CONVEX_SITE_URL ?? process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? '';
}

export function getSiteURL() {
  const siteUrl = process.env.SITE_URL?.trim();

  if (siteUrl) {
    return siteUrl;
  }

  return 'http://localhost:8081';
}

function parseTrustedOrigins(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function getTrustedOrigins() {
  const siteUrl = process.env.SITE_URL?.trim();
  const explicitOrigins = [
    ...(siteUrl ? [siteUrl] : []),
    ...parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
  ];

  return [
    ...new Set([
      ...defaultTrustedOrigins,
      ...(shouldIncludeLocalTrustedOrigins(explicitOrigins) ? localTrustedOrigins : []),
      ...explicitOrigins,
    ]),
  ];
}

export function getAuthBaseURL() {
  return getAuthBaseUrl() || undefined;
}

function buildLocalTrustedOrigins() {
  const hosts = ['localhost', '127.0.0.1'];
  const ports = ['8081', '8082', '8083', '19006'];
  return hosts.flatMap(host => ports.map(port => `http://${host}:${port}`));
}

function shouldIncludeLocalTrustedOrigins(explicitOrigins: string[]) {
  if (!isDevelopmentAuthContext()) {
    return false;
  }

  if (explicitOrigins.length === 0) {
    return true;
  }

  return explicitOrigins.some(isLocalWebOrigin);
}

function isLocalWebOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

function isDevelopmentAuthContext() {
  return process.env.NODE_ENV !== 'production';
}
