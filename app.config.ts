import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const selectedEnvFile = process.env.REED_ENV_FILE ?? '.env.local';
const resolvedEnvFile = resolve(selectedEnvFile);

if (existsSync(resolvedEnvFile)) {
  loadEnv({ path: resolvedEnvFile, override: true, quiet: true });
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
  ios: {
    supportsTablet: true,
    bundleIdentifier: androidPackage,
  },
  android: {
    package: androidPackage,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/images/logo-mark-dark.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#f7f7f4',
        dark: {
          image: './assets/images/logo-mark.png',
          backgroundColor: '#040404',
        },
      },
    ],
    'expo-asset',
    'expo-secure-store',
    'expo-status-bar',
    'expo-web-browser',
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-notifications',
      {
        defaultChannel: 'rest-timer-alerts',
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
