const fallbackTrustedOrigin = 'reed://';

function getAuthBaseUrl() {
  return process.env.CONVEX_SITE_URL ?? process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? '';
}

export function getTrustedOrigin() {
  return fallbackTrustedOrigin;
}

export function getAuthBaseURL() {
  return getAuthBaseUrl() || undefined;
}
