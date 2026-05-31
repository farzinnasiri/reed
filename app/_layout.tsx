import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_800ExtraBold,
  Outfit_900Black,
  useFonts,
} from '@expo-google-fonts/outfit';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ConvexProvider } from 'convex/react';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Platform, StyleSheet, View } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { ReedThemeProvider, useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { convex, missingPublicEnv } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { requestAppCapabilityPermissionsAsync } from '@/lib/app-permissions';

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

  if (!fontsLoaded && !fontLoadError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ReedThemeProvider>
        <RootApp />
      </ReedThemeProvider>
    </SafeAreaProvider>
  );
}

function RootApp() {
  const { theme } = useReedTheme();
  const hasBootBlockingConfigError = !convex || missingPublicEnv.length > 0;

  useEffect(() => {
    if (hasBootBlockingConfigError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [hasBootBlockingConfigError]);

  if (hasBootBlockingConfigError) {
    return (
      <>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
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
    <ConvexProvider client={convexClient}>
      <ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
        <RootNavigator />
      </ConvexBetterAuthProvider>
    </ConvexProvider>
  );
}

function RootNavigator() {
  const { theme } = useReedTheme();
  const { data: session, isPending } = authClient.useSession();
  const viewer = useQuery(api.profiles.viewer, session ? {} : 'skip');
  const isAppReady = Boolean(session && viewer?.onboardingCompletedAt);
  const isRoutingPending = isPending || Boolean(session && viewer === undefined);

  useEffect(() => {
    if (!isRoutingPending) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isRoutingPending]);

  useEffect(() => {
    if (!isAppReady) {
      return;
    }

    void requestAppCapabilityPermissionsAsync();
  }, [isAppReady]);

  if (isRoutingPending) {
    return (
      <>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
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
