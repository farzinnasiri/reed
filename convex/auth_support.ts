const defaultTrustedOrigins = ['reed://'];
const localTrustedOrigins = ['http://localhost:8081', 'http://127.0.0.1:8081'];

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

function hasExplicitWebOriginConfig() {
  return Boolean(
    process.env.SITE_URL?.trim() || parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS).length,
  );
}

export function getTrustedOrigins() {
  const siteUrl = process.env.SITE_URL?.trim();

  return [
    ...new Set([
      ...defaultTrustedOrigins,
      ...(hasExplicitWebOriginConfig() ? [] : localTrustedOrigins),
      ...(siteUrl ? [siteUrl] : []),
      ...parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
    ]),
  ];
}

export function getAuthBaseURL() {
  return getAuthBaseUrl() || undefined;
}
