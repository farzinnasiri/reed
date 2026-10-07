import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import { reedMotion } from '@/design/motion';
import { useEntryAnimation } from '@/design/use-entry-animation';

/** A quiet text change. Screen readers hear the wait state, not every decorative phrase. */
export function PendingStatus({ text }: { text: string }) {
  const label = text === 'Listening' ? 'Listening' : text === 'Transcribing' ? 'Transcribing audio' : 'Waiting for Reed to reply';
  return <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite">
    <StatusLine key={text} text={text} />
  </View>;
}

function StatusLine({ text }: { text: string }) {
  const entry = useEntryAnimation({ duration: reedMotion.presence.hintSwapMs, translateY: reedMotion.presence.hintSwapY });
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={entry}>
    <ReedText tone="muted" variant="caption" numberOfLines={2}>{text}</ReedText>
  </Animated.View>;
}
