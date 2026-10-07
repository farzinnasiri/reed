import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import * as haptics from '@/design/haptics';

export function WorkoutMenu({ hasOpenSession, onClose, onOpenSession, onOpenSessions, onQuickLog, visible }: {
  hasOpenSession: boolean;
  onClose: () => void;
  onOpenSession: () => void;
  onOpenSessions: () => void;
  onQuickLog: () => void;
  visible: boolean;
}) {
  const { theme } = useReedTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const pendingAction = useRef<(() => void) | null>(null);

  function choose(action: () => void) {
    haptics.selection();
    pendingAction.current = action;
    sheetRef.current?.dismiss();
  }

  return (
    <ReedSheet open={visible} ref={sheetRef} onDismiss={() => {
      const action = pendingAction.current;
      pendingAction.current = null;
      onClose();
      action?.();
    }}>
      <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, overflow: 'hidden', paddingHorizontal: theme.spacing.md }}>
        {[
          { label: hasOpenSession ? 'Resume workout' : 'Start a workout', icon: 'barbell-outline' as const, action: onOpenSession },
          { label: 'Quick log', icon: 'flash-outline' as const, action: onQuickLog },
          { label: 'Sessions', icon: 'time-outline' as const, action: onOpenSessions },
        ].map((item, index) => (
          <Pressable
            accessibilityRole="button"
            key={item.label}
            onPress={() => choose(item.action)}
            style={({ pressed }) => [
              { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm, minHeight: 52 },
              index > 0 ? { borderTopColor: theme.colors.line, borderTopWidth: 1 } : null,
              getTapScaleStyle(pressed),
            ]}
          >
            <Ionicons color={String(theme.colors.inkSecondary)} name={item.icon} size={20} />
            <ReedText>{item.label}</ReedText>
          </Pressable>
        ))}
      </View>
    </ReedSheet>
  );
}
