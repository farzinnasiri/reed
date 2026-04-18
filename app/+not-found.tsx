import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <ScreenBackdrop>
        <View style={styles.container}>
          <GlassSurface style={styles.card}>
            <ReedText variant="brand">404</ReedText>
            <ReedText variant="title">This route does not exist.</ReedText>
            <ReedText tone="muted">
              The app shell is still alive. This path just doesn&apos;t map to a screen yet.
            </ReedText>
            <Link href="/" asChild>
              <ReedButton label="Go back to Reed" />
            </Link>
          </GlassSurface>
        </View>
      </ScreenBackdrop>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    maxWidth: 420,
    width: '100%',
  },
});
