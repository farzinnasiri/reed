import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';

type ProgressSectionProps = {
  children: ReactNode;
  /** Muted text on the right of the title, such as the range or a count. */
  meta?: string;
  title: string;
  /** Controls on the right of the title row (goal add/expand); replaces `meta`. */
  trailing?: ReactNode;
};

// One section of the expanded Pulse: a `card` on `surface` with a headline row. The content below
// it is the caller's.
export function ProgressSection({ children, meta, title, trailing }: ProgressSectionProps) {
  const { theme } = useReedTheme();

  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card }]}>
      <View style={styles.header}>
        <ReedText style={styles.title} variant="headline">{title}</ReedText>
        {trailing ?? (meta ? <ReedText numberOfLines={1} style={styles.meta} tone="muted" variant="caption">{meta}</ReedText> : null)}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 24,
  },
  meta: {
    flexShrink: 1,
    textAlign: 'right',
  },
  section: {
    gap: 12,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    flexShrink: 0,
  },
});
