import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';

type HeaderAction = {
  accessibilityLabel: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconSize?: number;
  onPress: () => void;
};

type ScreenHeaderBase = {
  children?: ReactNode;
};

type IdentityHeader = ScreenHeaderBase & {
  variant: 'identity';
  action?: HeaderAction;
};

type ModalHeader = ScreenHeaderBase & {
  variant: 'modal';
  onBack?: () => void;
  backAccessibilityLabel?: string;
};

type DetailHeader = ScreenHeaderBase & {
  variant: 'detail';
  onBack: () => void;
  backAccessibilityLabel?: string;
  title: string;
};

export type ScreenHeaderProps = IdentityHeader | ModalHeader | DetailHeader;

export function ScreenHeader(props: ScreenHeaderProps) {
  const { theme } = useReedTheme();

  if (props.variant === 'identity') {
    return (
      <View style={styles.row}>
        <View style={styles.copy}>{props.children}</View>
        {props.action ? (
          <ReedIconButton
            accessibilityLabel={props.action.accessibilityLabel}
            onPress={props.action.onPress}
            shape="pill"
            variant="glass"
          >
            <Ionicons
              color={String(theme.colors.textPrimary)}
              name={props.action.iconName}
              size={props.action.iconSize ?? 18}
            />
          </ReedIconButton>
        ) : null}
      </View>
    );
  }

  if (props.variant === 'modal') {
    return (
      <View style={styles.modalRow}>
        <View style={styles.slot}>
          {props.onBack ? (
            <ReedIconButton
              accessibilityLabel={props.backAccessibilityLabel ?? 'Go back'}
              onPress={props.onBack}
              shape="pill"
              variant="glass"
            >
              <Ionicons color={String(theme.colors.textPrimary)} name="arrow-back" size={18} />
            </ReedIconButton>
          ) : null}
        </View>
        <ReedText style={styles.modalTitle} variant="display">
          {props.children}
        </ReedText>
        <View style={styles.slot} />
      </View>
    );
  }

  if (props.variant === 'detail') {
    return (
      <View style={styles.detailRow}>
        <ReedIconButton
          accessibilityLabel={props.backAccessibilityLabel ?? 'Go back'}
          onPress={props.onBack}
          shape="pill"
          variant="glass"
        >
          <Ionicons color={String(theme.colors.textPrimary)} name="arrow-back" size={16} />
        </ReedIconButton>
        <ReedText variant="bodyStrong">{props.title}</ReedText>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
  },
  modalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  copy: {
    flex: 1,
    gap: 8,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  slot: {
    height: 44,
    width: 44,
  },
});
