import { StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { ChipSelect } from './chip-select';

type Group = {
  title: string;
  options: { label: string; value: string }[];
};

type GroupedChipSelectProps = {
  groups: Group[];
  max: number;
  onChange: (selected: string[]) => void;
  selected: string[];
};

export function GroupedChipSelect({
  groups,
  max,
  onChange,
  selected,
}: GroupedChipSelectProps) {
  // Design note: this is a fully controlled component. `handleGroupChange` closes
  // over `selected` from the render scope. Rapid concurrent taps across two groups
  // could cause the second onChange to use a stale `selected` (React batches state).
  // In practice this is not a real risk in an onboarding form — users tap one chip
  // at a time. Fixing it would require lifting state into this component, which would
  // then desync from the parent's draft on re-renders. The current tradeoff is correct.
  function handleGroupChange(groupSelected: string[], groupOptions: Group['options']) {
    // Determine what was added or removed
    const previouslySelectedInGroup = selected.filter(val => groupOptions.some(o => o.value === val));
    
    // If an item was removed
    if (groupSelected.length < previouslySelectedInGroup.length) {
      const removed = previouslySelectedInGroup.find(val => !groupSelected.includes(val));
      if (removed) {
        onChange(selected.filter(val => val !== removed));
      }
      return;
    }

    // If an item was added
    const added = groupSelected.find(val => !previouslySelectedInGroup.includes(val));
    if (added) {
      const newSelected = [...selected, added];
      if (newSelected.length > max) {
        // Evict oldest globally
        onChange(newSelected.slice(newSelected.length - max));
      } else {
        onChange(newSelected);
      }
    }
  }

  return (
    <View style={styles.section}>
      {groups.map((group, idx) => {
        // Find which items from this group are currently selected
        const selectedInGroup = selected.filter(val =>
          group.options.some(o => o.value === val)
        );

        return (
          <View key={idx} style={styles.group}>
            <ReedText variant="bodyStrong" tone="muted">
              {group.title}
            </ReedText>
            <ChipSelect<string>
              max={0} // Let GroupedChipSelect handle the global maximum
              onChange={newGroupSelected => handleGroupChange(newGroupSelected, group.options)}
              options={group.options}
              selected={selectedInGroup}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 28,
  },
  group: {
    gap: 12,
  },
});
