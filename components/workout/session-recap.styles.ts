import { StyleSheet } from 'react-native';
import { reedRadii, SCREEN_CONTENT_HORIZONTAL_MARGIN } from '@/design/system';

export const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 24, paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN },
  hero: { alignItems: 'center', gap: 4 },
  heroLine: { textAlign: 'center' },
  heroMeta: { textAlign: 'center' },
  section: { gap: 12 },
  suggestion: { alignItems: 'center', borderRadius: reedRadii.md, flexDirection: 'row', gap: 12, padding: 14 },
  suggestionCopy: { flex: 1, gap: 2, minWidth: 0 },
  sectionTitle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  card: { borderRadius: reedRadii.card, gap: 8, paddingBottom: 16, paddingHorizontal: 18, paddingTop: 16 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  cardCopy: { flex: 1, gap: 2, minWidth: 0 },
  badge: {
    alignItems: 'center',
    borderRadius: reedRadii.xs,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sets: { gap: 8, paddingTop: 4 },
  setRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 28 },
  setDot: { borderRadius: reedRadii.pill, height: 8, width: 8 },
  empty: { alignItems: 'center', minHeight: 160, justifyContent: 'center' },
});
