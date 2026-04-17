import { AuthLoading, Authenticated, Unauthenticated } from 'convex/react';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>Reed</Text>
      <Text style={styles.title}>Expo Router and Convex are wired. Product work starts from here.</Text>
      <Text style={styles.copy}>
        This scaffold keeps the app greenfield on purpose. The legacy prototype is preserved under
        <Text style={styles.code}> legacy/</Text>.
      </Text>

      <AuthLoading>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Checking auth</Text>
          <Text style={styles.cardCopy}>Convex is resolving the current session.</Text>
        </View>
      </AuthLoading>

      <Unauthenticated>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Auth shell only</Text>
          <Text style={styles.cardCopy}>
            Convex auth plumbing is installed, but sign-in UI is intentionally not built yet.
          </Text>
        </View>
      </Unauthenticated>

      <Authenticated>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Authenticated</Text>
          <Text style={styles.cardCopy}>
            The app shell is ready for protected routes and Android-first React Native feature work.
          </Text>
        </View>
      </Authenticated>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#020617',
    gap: 12,
  },
  brand: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
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
  card: {
    marginTop: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 8,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  cardCopy: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
});
