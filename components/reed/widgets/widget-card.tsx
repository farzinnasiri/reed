import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';

/** A disclosure owns the surface; its content supplies only padding and controls. */
export const WidgetCardEmbeddedContext = createContext(false);

type WidgetCardProps = {
  children: ReactNode;
  /** Muted text on the right of the header row. */
  meta?: string;
  /** Today cards only: hides the card for the rest of the local day. */
  onDismiss?: () => void;
  /** Why Reed brought this: a 6px accent dot and a line of muted text above the header. */
  origin?: string;
  /** Omit for a card whose content speaks for itself (the session change). */
  title?: string;
};

/** Widget anatomy (DESIGN.md → Widgets): `surface` card, optional origin line, header, content. */
export function WidgetCard({ children, meta, onDismiss, origin, title }: WidgetCardProps) {
  const { theme } = useReedTheme();
  const embedded = useContext(WidgetCardEmbeddedContext);

  return (
    <View style={embedded
      ? { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }
      : [styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card }]}>
      {origin || onDismiss ? (
        <View style={styles.originRow}>
          {origin ? (
            <>
              <View style={[styles.originDot, { backgroundColor: theme.colors.accent }]} />
              <ReedText numberOfLines={1} style={styles.origin} tone="muted" variant="micro">{origin}</ReedText>
            </>
          ) : <View style={styles.origin} />}
          {onDismiss ? (
            <Pressable
              accessibilityLabel="Hide for today"
              accessibilityRole="button"
              hitSlop={14}
              onPress={onDismiss}
              style={({ pressed }) => getTapScaleStyle(pressed)}
            >
              <Ionicons color={String(theme.colors.inkMuted)} name="close" size={16} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {title ? (
        <View style={styles.header}>
          <ReedText variant="headline">{title}</ReedText>
          {meta ? <ReedText numberOfLines={1} style={styles.meta} tone="muted" variant="caption">{meta}</ReedText> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meta: {
    flexShrink: 1,
  },
  origin: {
    flex: 1,
  },
  originDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  originRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
});
