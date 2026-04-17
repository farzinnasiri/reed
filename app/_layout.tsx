import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConvexProvider } from 'convex/react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import { authClient } from '@/lib/auth-client';
import { convex, missingPublicEnv } from '@/lib/convex';

export {
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  if (!convex || missingPublicEnv.length > 0) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.screen}>
            <Text style={styles.eyebrow}>Missing environment</Text>
            <Text style={styles.title}>Reed needs public Expo env values before the app can boot.</Text>
            <Text style={styles.copy}>
              Add the missing keys to <Text style={styles.code}>.env.local</Text> and restart Expo.
            </Text>
            {missingPublicEnv.map(name => (
              <Text key={name} style={styles.missingItem}>
                {name}
              </Text>
            ))}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ConvexProvider client={convex}>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </ConvexBetterAuthProvider>
      </ConvexProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  eyebrow: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  copy: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  code: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  missingItem: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
  },
});
