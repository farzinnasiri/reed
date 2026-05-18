import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { styles as reedStyles } from './reed.styles';

type ReedAttitude = {
  _id: Id<'reedAttitudes'>;
  key: string;
  name: string;
  description: string;
  prompt: string;
  sortOrder: number;
};

type FallbackAttitude = Omit<ReedAttitude, '_id' | 'sortOrder'> & {
  _id: null;
};

type AttitudeOption = {
  id: Id<'reedAttitudes'> | null;
  key: string;
  name: string;
  description: string;
  prompt: string;
};

const ATTITUDE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  default: 'radio-button-off-outline',
  academic: 'school-outline',
  analytical: 'analytics-outline',
  drill_sergeant: 'megaphone-outline',
  minimalist: 'remove-outline',
  practical_operator: 'construct-outline',
  soft_supportive: 'leaf-outline',
  steady_coach: 'compass-outline',
  tough_love: 'flame-outline',
};

export function ReedAiSettingsPage({
  contentTopPadding,
  dockReservedSpace,
  onBack,
  topInset,
}: {
  contentTopPadding: number;
  dockReservedSpace: number;
  onBack: () => void;
  topInset: number;
}) {
  const { theme } = useReedTheme();
  const attitudes = useQuery(api.reed.listAttitudes, {}) as ReedAttitude[] | undefined;
  const settings = useQuery(api.reed.getAiSettings, {}) as {
    fallbackAttitude: FallbackAttitude;
    selectedAttitudeId: Id<'reedAttitudes'> | null;
  } | undefined;
  const setAiAttitude = useMutation(api.reed.setAiAttitude);
  const [pendingAttitudeId, setPendingAttitudeId] = useState<Id<'reedAttitudes'> | null | undefined>(undefined);
  const selectedAttitudeId = pendingAttitudeId !== undefined ? pendingAttitudeId : settings?.selectedAttitudeId ?? null;
  const isLoading = attitudes === undefined || settings === undefined;
  const options = useMemo<AttitudeOption[]>(() => {
    const fallback: AttitudeOption[] = settings?.fallbackAttitude
      ? [{
          id: null,
          key: settings.fallbackAttitude.key,
          name: settings.fallbackAttitude.name,
          description: settings.fallbackAttitude.description,
          prompt: settings.fallbackAttitude.prompt,
        }]
      : [];
    const stored: AttitudeOption[] = (attitudes ?? []).map(attitude => ({
      id: attitude._id,
      key: attitude.key,
      name: attitude.name,
      description: attitude.description,
      prompt: attitude.prompt,
    }));

    return fallback.concat(stored);
  }, [attitudes, settings?.fallbackAttitude]);
  const selectedOption = options.find(option => option.id === selectedAttitudeId) ?? options[0] ?? null;

  async function chooseAttitude(attitudeId: Id<'reedAttitudes'> | null) {
    if (attitudeId === selectedAttitudeId) return;
    setPendingAttitudeId(attitudeId);
    try {
      await setAiAttitude({ attitudeId });
    } finally {
      setPendingAttitudeId(undefined);
    }
  }

  return (
    <View style={reedStyles.root}>
      <GlassSurface
        elevated={false}
        contentStyle={[
          reedStyles.fixedHeaderContent,
          {
            paddingBottom: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            paddingTop: topInset,
          },
        ]}
        style={reedStyles.fixedHeader}
      >
        <View style={reedStyles.header}>
          <Pressable
            accessibilityHint="Returns to the Reed chat thread."
            accessibilityLabel="Back to Reed chat"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              reedStyles.headerAction,
              { borderColor: theme.colors.controlBorder },
              getTapScaleStyle(pressed),
            ]}
          >
            <Ionicons color={String(theme.colors.textMuted)} name="chevron-back" size={16} />
            <ReedText tone="muted" variant="caption">Reed</ReedText>
          </Pressable>
          <ReedText variant="title">AI settings</ReedText>
        </View>
      </GlassSurface>

      <ScrollView
        contentContainerStyle={[
          localStyles.content,
          {
            paddingBottom: dockReservedSpace + theme.spacing.xl,
            paddingHorizontal: theme.spacing.sm,
            paddingTop: contentTopPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {selectedOption ? <SelectedAttitudeCard option={selectedOption} /> : null}

        <View style={localStyles.optionStack}>
          {options.map(option => (
            <AttitudeOptionRow
              isPending={pendingAttitudeId === option.id}
              isSelected={selectedAttitudeId === option.id}
              key={option.id ?? option.key}
              onPress={() => void chooseAttitude(option.id)}
              option={option}
            />
          ))}
        </View>

        {isLoading ? (
          <LoadingRows />
        ) : options.length <= 1 ? (
          <View style={[localStyles.emptyState, { borderColor: theme.colors.controlBorder }]}> 
            <ReedText tone="muted" variant="caption">No custom attitudes yet.</ReedText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SelectedAttitudeCard({ option }: { option: AttitudeOption }) {
  const { theme } = useReedTheme();
  const iconName = ATTITUDE_ICONS[option.key] ?? 'sparkles-outline';

  return (
    <GlassSurface contentStyle={localStyles.selectedCardContent} elevated={false}>
      <View style={localStyles.selectedHeader}>
        <View
          style={[
            localStyles.selectedIcon,
            {
              backgroundColor: theme.colors.controlFill,
              borderColor: theme.colors.controlBorder,
            },
          ]}
        >
          <Ionicons color={String(theme.colors.textPrimary)} name={iconName} size={18} />
        </View>
        <View style={localStyles.selectedCopy}>
          <ReedText tone="muted" variant="label">Now active</ReedText>
          <ReedText variant="title">{option.name}</ReedText>
        </View>
      </View>
    </GlassSurface>
  );
}

function AttitudeOptionRow({
  isPending,
  isSelected,
  onPress,
  option,
}: {
  isPending: boolean;
  isSelected: boolean;
  onPress: () => void;
  option: AttitudeOption;
}) {
  const { theme } = useReedTheme();
  const iconName = ATTITUDE_ICONS[option.key] ?? 'sparkles-outline';

  return (
    <Pressable
      accessibilityHint="Sets Reed's coaching attitude."
      accessibilityLabel={`Use ${option.name} attitude`}
      accessibilityRole="button"
      accessibilityState={{ busy: isPending, selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        localStyles.optionRow,
        {
          borderColor: isSelected ? theme.colors.borderStrong : theme.colors.controlBorder,
          opacity: isPending ? 0.62 : 1,
          ...(isSelected ? { backgroundColor: theme.colors.controlFill } : null),
        },
        getTapScaleStyle(pressed, isPending),
      ]}
    >
      <View
        style={[
          localStyles.optionIcon,
          {
            backgroundColor: isSelected ? theme.colors.controlActiveFill : theme.colors.canvasSecondary,
            borderColor: theme.colors.controlBorder,
          },
        ]}
      >
        <Ionicons
          color={String(isSelected ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={iconName}
          size={17}
        />
      </View>

      <View style={localStyles.optionCopy}>
        <View style={localStyles.optionTitleRow}>
          <ReedText variant="bodyStrong">{option.name}</ReedText>
          {isSelected ? <ReedText tone="accent" variant="caption">Active</ReedText> : null}
        </View>
      </View>

      <Ionicons
        color={String(isSelected ? theme.colors.accentPrimary : theme.colors.textMuted)}
        name={isSelected ? 'checkmark-circle' : 'chevron-forward'}
        size={18}
      />
    </Pressable>
  );
}

function LoadingRows() {
  const { theme } = useReedTheme();

  return (
    <View style={localStyles.optionStack}>
      {[0, 1, 2].map(index => (
        <View
          key={index}
          style={[
            localStyles.loadingRow,
            {
              backgroundColor: theme.colors.controlFill,
              borderColor: theme.colors.controlBorder,
            },
          ]}
        />
      ))}
    </View>
  );
}

const localStyles = StyleSheet.create({
  content: {
    gap: 18,
  },
  selectedCardContent: {
    gap: 14,
    padding: 18,
  },
  selectedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  selectedIcon: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  selectedCopy: {
    flex: 1,
    gap: 1,
  },
  optionStack: {
    gap: 8,
  },
  optionRow: {
    alignItems: 'center',
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionIcon: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  optionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  optionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  emptyState: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  loadingRow: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    height: 74,
    opacity: 0.42,
  },
});
