import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { WidgetCard } from './widget-card';
import { ExpandableWidget, type WidgetDisclosure } from './expandable-widget';

const COLUMNS = 3;
// Five presets and "More" fill two rows of the grid.
const MAX_TILES = 5;

type QuickLogCardProps = {
  /** `null` opens the full quick-log sheet. */
  onOpenQuickLog: (presetKey: string | null) => void;
  onDismiss?: () => void;
  origin?: string;
  presetKeys: string[];
  disclosure?: WidgetDisclosure;
};

/**
 * The quick logs Reed picked: a tile per preset that opens the existing quick-log flow with it
 * selected, and "More" for the full sheet. Labels come from the live preset list, so a preset
 * that has since been disabled simply drops out.
 */
export function QuickLogCard({ onDismiss, onOpenQuickLog, origin, presetKeys, disclosure }: QuickLogCardProps) {
  const { theme } = useReedTheme();
  const presets = useQuery(api.quickLogs.listPresets, {});

  if (presets === undefined) return null;

  const tiles = presetKeys
    .flatMap(key => {
      const preset = presets.find(candidate => candidate.key === key);
      return preset ? [{ key, label: preset.label }] : [];
    })
    .slice(0, MAX_TILES);
  const cells: Array<{ key: string; label: string } | null> = [...tiles, null];
  const rows = Array.from({ length: Math.ceil(cells.length / COLUMNS) }, (_, row) => cells.slice(row * COLUMNS, (row + 1) * COLUMNS));

  const content = (
    <WidgetCard meta="Logs straight to today" onDismiss={disclosure ? undefined : onDismiss} origin={disclosure ? undefined : origin} title={disclosure ? undefined : 'Quick log'}>
      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {Array.from({ length: COLUMNS }, (_, column) => {
              const cell = row[column];
              if (cell === undefined) return <View key={column} style={styles.cell} />;
              const isMore = cell === null;
              return (
                <Pressable
                  accessibilityLabel={isMore ? 'More quick logs' : `Quick log ${cell.label}`}
                  accessibilityRole="button"
                  key={column}
                  onPress={() => onOpenQuickLog(isMore ? null : cell.key)}
                  style={({ pressed }) => [
                    styles.cell,
                    styles.tile,
                    isMore
                      ? { borderColor: theme.colors.lineStrong, borderWidth: 1 }
                      : { backgroundColor: theme.colors.surfaceRaised },
                    getTapScaleStyle(pressed),
                  ]}
                >
                  <ReedText numberOfLines={1} tone={isMore ? 'muted' : 'default'}>{isMore ? 'More' : cell.label}</ReedText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </WidgetCard>
  );
  return disclosure ? <ExpandableWidget disclosure={disclosure} summary={{ label: 'Quick log', icon: 'fitness-outline', detail: `${tiles.length} activities`, expandedDetail: 'Logs straight to today' }}>{content}</ExpandableWidget> : content;
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
  },
  grid: {
    gap: 8,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
