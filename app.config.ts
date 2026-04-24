import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const selectedEnvFile = process.env.REED_ENV_FILE ?? '.env.local';
const resolvedEnvFile = resolve(selectedEnvFile);

if (existsSync(resolvedEnvFile)) {
  loadEnv({ path: resolvedEnvFile, override: true });
}

const appName = 'reed';
const slug = 'reed';
const scheme = 'reed';
const androidPackage = 'com.farzinnasiri.reed';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName,
  slug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme,
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#020617',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: androidPackage,
  },
  android: {
    package: androidPackage,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#020617',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-notifications',
      {
        defaultChannel: 'rest-timer',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'c18d73a3-d9b8-405e-a082-2bdcd9069f45',
    },
    convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? '',
    convexSiteUrl: process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? '',
  },
});
