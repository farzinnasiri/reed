import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { getCoachItemColor } from './reed.presenter';
import { styles } from './reed.styles';
import type { CoachItem } from './reed.types';

export function ReedCoachItemsPage({
  contentTopPadding,
  dockReservedSpace,
  items,
  onBack,
  onResolve,
  topInset,
}: {
  contentTopPadding: number;
  dockReservedSpace: number;
  items: CoachItem[];
  onBack: () => void;
  onResolve: (itemId: string) => void;
  topInset: number;
}) {
  const { theme } = useReedTheme();
  const openItems = items.filter(item => item.status === 'open');
  const resolvedItems = items.filter(item => item.status === 'resolved');

  return (
    <View style={styles.root}>
      <GlassSurface
        elevated={false}
        contentStyle={[
          styles.fixedHeaderContent,
          {
            paddingBottom: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            paddingTop: topInset,
          },
        ]}
        style={styles.fixedHeader}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityHint="Returns to the Reed chat thread."
            accessibilityLabel="Back to Reed chat"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              styles.headerAction,
              { borderColor: theme.colors.controlBorder },
              getTapScaleStyle(pressed),
            ]}
          >
            <Ionicons color={String(theme.colors.textMuted)} name="chevron-back" size={16} />
            <ReedText tone="muted" variant="caption">Reed</ReedText>
          </Pressable>
          <ReedText variant="title">Coach items</ReedText>
        </View>
      </GlassSurface>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: dockReservedSpace + theme.spacing.xl,
            paddingHorizontal: theme.spacing.sm,
            paddingTop: contentTopPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.todayStrip, { borderColor: theme.colors.controlBorder }]}> 
          <View style={styles.todayCopy}>
            <ReedText tone="muted" variant="label">Open</ReedText>
            <ReedText variant="bodyStrong">
              {openItems.length > 0 ? `${openItems.length} thing${openItems.length === 1 ? '' : 's'} to revisit.` : 'Nothing waiting.'}
            </ReedText>
          </View>
        </View>

        <View style={styles.coachItemStack}>
          {openItems.map(item => (
            <CoachItemRow item={item} key={item.id} onResolve={onResolve} />
          ))}
          {openItems.length === 0 ? (
            <ReedText tone="muted" variant="caption">Saved coach notes will land here when Reed finds something worth remembering.</ReedText>
          ) : null}
        </View>

        {resolvedItems.length > 0 ? (
          <View style={styles.coachItemsBlock}>
            <ReedText tone="muted" variant="label">Resolved</ReedText>
            <View style={styles.coachItemStack}>
              {resolvedItems.map(item => (
                <CoachItemRow item={item} key={item.id} onResolve={onResolve} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function CoachItemRow({ item, onResolve }: { item: CoachItem; onResolve: (itemId: string) => void }) {
  const { theme } = useReedTheme();
  const isResolved = item.status === 'resolved';

  return (
    <View style={[styles.coachItemRow, { borderColor: theme.colors.controlBorder, opacity: isResolved ? 0.58 : 1 }]}> 
      <View style={[styles.coachItemDot, { backgroundColor: getCoachItemColor(theme, item.type) }]} />
      <View style={styles.coachItemCopy}>
        <ReedText variant="bodyStrong">{item.title}</ReedText>
        <ReedText tone="muted" variant="caption">{item.body}</ReedText>
      </View>
      {isResolved ? null : (
        <Pressable
          accessibilityHint="Marks this coach item as resolved."
          accessibilityLabel={`Resolve ${item.title}`}
          accessibilityRole="button"
          onPress={() => onResolve(item.id)}
          style={({ pressed }) => [styles.coachItemAction, getTapScaleStyle(pressed)]}
        >
          <Ionicons color={String(theme.colors.textMuted)} name="checkmark" size={18} />
        </Pressable>
      )}
    </View>
  );
}
