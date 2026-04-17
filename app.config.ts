import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

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
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? '',
    convexSiteUrl: process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? '',
  },
});
