import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Surface } from '@/components/ui/surface';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <ScreenBackdrop>
        <View style={styles.container}>
          <Surface style={styles.card}>
            <ReedText variant="caption">404</ReedText>
            <ReedText variant="title">This route does not exist.</ReedText>
            <ReedText tone="muted">
              The app shell is still alive. This path just doesn&apos;t map to a screen yet.
            </ReedText>
            <Link href="/" asChild>
              <ReedButton label="Go back to Reed" />
            </Link>
          </Surface>
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
