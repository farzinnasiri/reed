const publicEnv = {
  convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? '',
  convexSiteUrl: process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? '',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
} as const;

export const missingPublicEnv = Object.entries({
  EXPO_PUBLIC_CONVEX_URL: publicEnv.convexUrl,
  EXPO_PUBLIC_CONVEX_SITE_URL: publicEnv.convexSiteUrl,
}).reduce<string[]>((missing, [key, value]) => {
  if (!value) missing.push(key);
  return missing;
}, []);

export const appEnv = publicEnv;
