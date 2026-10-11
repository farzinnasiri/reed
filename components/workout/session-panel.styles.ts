import { StyleSheet } from 'react-native';
import { reedTheme, reedSessionMetrics } from '@/design/system';
const { spacing } = reedTheme;
export const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: { alignItems: 'flex-start', flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  duration: { minHeight: reedSessionMetrics.hit, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  exercise: { minHeight: reedSessionMetrics.panelExerciseRow, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  content: { paddingBottom: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xxs },
  finish: { gap: spacing.xs, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
});
