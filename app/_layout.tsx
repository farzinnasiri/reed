import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_800ExtraBold,
  Outfit_900Black,
  useFonts,
} from '@expo-google-fonts/outfit';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PostHogErrorBoundary, PostHogProvider } from 'posthog-react-native';
import { posthog } from '@/lib/posthog';
import { analytics } from '@/lib/analytics';
import {
  getStartupResult,
  getStartupViewerState,
  hideSplashAndEndStartup,
  markStartupAuthReady,
  markStartupConfigReady,
  markStartupFontsReady,
  markStartupViewerReady,
} from '@/lib/startup-observability';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { ReedThemeProvider, useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { appEnv } from '@/lib/env';
import { convex, missingPublicEnv } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { requestAppCapabilityPermissionsAsync } from '@/lib/app-permissions';
import { registerPushDeviceAsync } from '@/lib/push-notifications';

export {
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontLoadError] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });
  const pathname = usePathname();
  const previousPathname = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      analytics.screen(pathname, previousPathname.current);
      previousPathname.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    if (!fontsLoaded && !fontLoadError) {
      return;
    }

    markStartupFontsReady(Boolean(fontLoadError));
  }, [fontLoadError, fontsLoaded]);

  if (!fontsLoaded && !fontLoadError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ReedThemeProvider>
        <GestureHandlerRootView style={styles.gestureRoot}>
          <KeyboardProvider>
            <PostHogProvider
              client={posthog}
              autocapture={{
                captureScreens: false,
                captureTouches: true,
                propsToCapture: ['testID'],
                maxElementsCaptured: 20,
              }}
            >
              <PostHogErrorBoundary
                additionalProperties={() => ({
                  'error.boundary': 'root',
                  'event.kind': 'operational',
                  'screen.name': pathname,
                })}
                fallback={RootErrorFallback}
              >
                <RootApp />
              </PostHogErrorBoundary>
            </PostHogProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ReedThemeProvider>
    </SafeAreaProvider>
  );
}

function RootErrorFallback() {
  const { theme } = useReedTheme();

  return (
    <>
      <StatusBar
        backgroundColor="transparent"
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        translucent
      />
      <ScreenBackdrop>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.screen}>
            <GlassSurface>
              <ReedText variant="brand">Reed</ReedText>
              <ReedText variant="display">Something went wrong.</ReedText>
              <ReedText tone="muted">Close and reopen the app.</ReedText>
            </GlassSurface>
          </View>
        </SafeAreaView>
      </ScreenBackdrop>
    </>
  );
}

function RootApp() {
  const { theme } = useReedTheme();
  const hasBootBlockingConfigError = !convex || missingPublicEnv.length > 0;

  useEffect(() => {
    if (hasBootBlockingConfigError) {
      markStartupConfigReady(missingPublicEnv.length);
      hideSplashAndEndStartup('config_error', {
        'auth.state': 'not_started',
        'viewer.state': 'not_started',
      });
    }
  }, [hasBootBlockingConfigError]);

  if (hasBootBlockingConfigError) {
    return (
      <>
        <StatusBar
          backgroundColor="transparent"
          barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
          translucent
        />
        <ScreenBackdrop>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.screen}>
              <GlassSurface>
                <ReedText variant="brand">Missing environment</ReedText>
                <ReedText variant="display">Reed needs public Expo values before it can boot.</ReedText>
                <ReedText tone="muted">
                  Add the missing keys to <ReedText variant="bodyStrong">.env.dev</ReedText> and
                  restart Expo.
                </ReedText>
                <View style={styles.missingList}>
                  {missingPublicEnv.map(name => (
                    <View
                      key={name}
                      style={[
                        styles.missingSurface,
                        {
                          backgroundColor: theme.colors.controlFill,
                          borderColor: theme.colors.controlBorder,
                        },
                      ]}
                    >
                      <ReedText tone="danger" variant="bodyStrong">
                        {name}
                      </ReedText>
                    </View>
                  ))}
                </View>
              </GlassSurface>
            </View>
          </SafeAreaView>
        </ScreenBackdrop>
      </>
    );
  }

  if (!convex) {
    return null;
  }

  const convexClient = convex;

  return (
    <ClerkProvider publishableKey={appEnv.clerkPublishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <RootNavigator />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function RootNavigator() {
  const { theme } = useReedTheme();
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const session = isSignedIn && isAuthenticated;
  const viewer = useQuery(api.profiles.viewer, session ? {} : 'skip');
  const disableNotificationDevice = useMutation(api.notificationDevices.disableCurrentDevice);
  const registerNotificationDevice = useMutation(api.notificationDevices.registerDevice);
  const isAppReady = Boolean(session && viewer?.onboardingCompletedAt);
  const isRoutingPending = !isClerkLoaded || isConvexAuthLoading || Boolean(session && viewer === undefined);
  const hasMarkedAuthReady = useRef(false);
  const hasMarkedViewerReady = useRef(false);

  useEffect(() => {
    if (!isRoutingPending) {
      hideSplashAndEndStartup(getStartupResult(session, viewer), {
        'auth.state': session ? 'signed_in' : 'signed_out',
        'viewer.state': getStartupViewerState(session, viewer),
      });
    }
  }, [isRoutingPending, session, viewer]);

  useEffect(() => {
    if (!isClerkLoaded || isConvexAuthLoading || hasMarkedAuthReady.current) {
      return;
    }

    hasMarkedAuthReady.current = true;
    markStartupAuthReady(session);
  }, [isClerkLoaded, isConvexAuthLoading, session]);

  useEffect(() => {
    if (!session || viewer === undefined || hasMarkedViewerReady.current) {
      return;
    }

    hasMarkedViewerReady.current = true;
    markStartupViewerReady(session, viewer);
  }, [session, viewer]);

  useEffect(() => {
    if (viewer) {
      analytics.identifyProfile(viewer);
    }
  }, [viewer]);

  useEffect(() => {
    if (!isAppReady) {
      return;
    }

    void requestAppCapabilityPermissionsAsync();
    void registerPushDeviceAsync({
      disableDevice: disableNotificationDevice,
      registerDevice: registerNotificationDevice,
    });
  }, [disableNotificationDevice, isAppReady, registerNotificationDevice]);

  if (isRoutingPending) {
    return (
      <>
        <StatusBar
          backgroundColor="transparent"
          barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
          translucent
        />
      </>
    );
  }

  return (
    <>
      <StatusBar
        backgroundColor="transparent"
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        translucent
      />
      <Stack
        screenOptions={{
          animation: Platform.OS === 'web' ? 'none' : 'fade_from_bottom',
          contentStyle: { backgroundColor: theme.colors.canvas },
          fullScreenGestureEnabled: true,
          fullScreenGestureShadowEnabled: false,
          gestureEnabled: true,
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={isAppReady}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  missingList: {
    gap: 10,
  },
  missingSurface: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
  },
  missingItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
