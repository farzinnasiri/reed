import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { Id } from '@/convex/_generated/dataModel';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { styles } from './workout-surface.styles';
import type { AddExerciseSheetData, CatalogItem } from './workout-surface.types';

type AddExerciseSheetProps = {
  data: AddExerciseSheetData | undefined;
  isOpen: boolean;
  isWorking: boolean;
  onAddBulk: (exerciseCatalogIds: Id<'exerciseCatalog'>[]) => void;
  onAddSingle: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelectEquipment: (value: string | null) => void;
  onSelectMuscleGroup: (value: string | null) => void;
  onToggleFavorite: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  searchText: string;
  selectedEquipment: string | null;
  selectedMuscleGroup: string | null;
};

export function AddExerciseSheet({
  data,
  isOpen,
  isWorking,
  onAddBulk,
  onAddSingle,
  onClose,
  onSearchChange,
  onSelectEquipment,
  onSelectMuscleGroup,
  onToggleFavorite,
  searchText,
  selectedEquipment,
  selectedMuscleGroup,
}: AddExerciseSheetProps) {
  const { theme } = useReedTheme();
  const panelFill =
    theme.mode === 'dark' ? 'rgba(24, 24, 27, 0.95)' : 'rgba(248, 250, 252, 0.94)';
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Id<'exerciseCatalog'>[]>([]);
  const selectedExerciseIdsSet = useMemo(() => new Set(selectedExerciseIds), [selectedExerciseIds]);

  const selectedCount = selectedExerciseIds.length;

  useEffect(() => {
    if (!isOpen) {
      setSelectedExerciseIds([]);
    }
  }, [isOpen]);

  function toggleSelectedExercise(exerciseCatalogId: Id<'exerciseCatalog'>) {
    setSelectedExerciseIds(current =>
      current.includes(exerciseCatalogId)
        ? current.filter(id => id !== exerciseCatalogId)
        : [...current, exerciseCatalogId],
    );
  }

  function handleAddBulk() {
    if (selectedExerciseIds.length === 0 || isWorking) {
      return;
    }

    onAddBulk(selectedExerciseIds);
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={styles.sheetOverlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.sheetPanel,
            {
              backgroundColor: panelFill,
              borderColor: theme.colors.borderSoft,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <ReedText variant="section">Add exercise</ReedText>
            <View style={styles.sheetHeaderActions}>
              {selectedCount > 0 ? (
                <Pressable
                  onPress={handleAddBulk}
                  style={({ pressed }) => [
                    styles.bulkAddHeaderButton,
                    {
                      backgroundColor: theme.colors.accentPrimary,
                      opacity: pressed || isWorking ? 0.9 : 1,
                    },
                  ]}
                >
                  <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
                    {isWorking ? 'Adding…' : `Add ${selectedCount}`}
                  </ReedText>
                </Pressable>
              ) : null}

              <Pressable onPress={onClose} style={styles.sheetClose}>
                <Ionicons color={String(theme.colors.textMuted)} name="close" size={18} />
              </Pressable>
            </View>
          </View>

          <View style={styles.sheetBody}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.sheetResultsScroll}
            >
              <CatalogSection
                isWorking={isWorking}
                items={data?.recents ?? []}
                onAddSingle={onAddSingle}
                onToggleFavorite={onToggleFavorite}
                onToggleSelected={toggleSelectedExercise}
                selectedExerciseIds={selectedExerciseIdsSet}
                title="Recents"
              />
              <CatalogSection
                isWorking={isWorking}
                items={data?.favorites ?? []}
                onAddSingle={onAddSingle}
                onToggleFavorite={onToggleFavorite}
                onToggleSelected={toggleSelectedExercise}
                selectedExerciseIds={selectedExerciseIdsSet}
                title="Favorites"
              />
              <CatalogSection
                isWorking={isWorking}
                items={data?.results ?? []}
                onAddSingle={onAddSingle}
                onToggleFavorite={onToggleFavorite}
                onToggleSelected={toggleSelectedExercise}
                selectedExerciseIds={selectedExerciseIdsSet}
                title="Results"
              />
            </ScrollView>

            <View style={styles.sheetBottomDock}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                <View style={styles.filtersRow}>
                  <FilterChip
                    isActive={selectedMuscleGroup === null}
                    label="All muscles"
                    onPress={() => onSelectMuscleGroup(null)}
                  />
                  {data?.muscleGroupOptions.map(option => (
                    <FilterChip
                      isActive={selectedMuscleGroup === option}
                      key={option}
                      label={option}
                      onPress={() => onSelectMuscleGroup(selectedMuscleGroup === option ? null : option)}
                    />
                  ))}
                </View>
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                <View style={styles.filtersRow}>
                  <FilterChip
                    isActive={selectedEquipment === null}
                    label="All equipment"
                    onPress={() => onSelectEquipment(null)}
                  />
                  {data?.equipmentOptions.map(option => (
                    <FilterChip
                      isActive={selectedEquipment === option}
                      key={option}
                      label={option}
                      onPress={() => onSelectEquipment(selectedEquipment === option ? null : option)}
                    />
                  ))}
                </View>
              </ScrollView>

              <View
                style={[
                  styles.searchShell,
                  {
                    backgroundColor: theme.colors.controlFill,
                    borderColor: theme.colors.controlBorder,
                  },
                ]}
              >
                <Ionicons color={String(theme.colors.textMuted)} name="search" size={16} />
                <TextInput
                  onChangeText={onSearchChange}
                  placeholder="Search exercises"
                  placeholderTextColor={String(theme.colors.textMuted)}
                  style={[
                    styles.searchInput,
                    {
                      color: theme.colors.textPrimary,
                      fontFamily: theme.typography.body.fontFamily,
                    },
                  ]}
                  value={searchText}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CatalogSection({
  isWorking,
  items,
  onAddSingle,
  onToggleSelected,
  onToggleFavorite,
  selectedExerciseIds,
  title,
}: {
  isWorking: boolean;
  items: CatalogItem[];
  onAddSingle: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  onToggleSelected: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  onToggleFavorite: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  selectedExerciseIds: Set<Id<'exerciseCatalog'>>;
  title: string;
}) {
  const { theme } = useReedTheme();

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.catalogSection}>
      <ReedText tone="muted" variant="caption">
        {title}
      </ReedText>
      <View style={styles.catalogList}>
        {items.map((item, index) => {
          const isSelected = selectedExerciseIds.has(item._id);

          return (
            <View
              key={item._id}
              style={[
                styles.catalogRow,
                {
                  borderBottomColor: theme.colors.controlBorder,
                  borderBottomWidth: index === items.length - 1 ? 0 : 1,
                },
              ]}
            >
              <Pressable disabled={isWorking} onPress={() => onAddSingle(item._id)} style={styles.catalogRowPressable}>
                <View style={styles.catalogRowCopy}>
                  <ReedText numberOfLines={1} variant="bodyStrong">
                    {item.name}
                  </ReedText>
                  <ReedText numberOfLines={1} tone="muted" variant="caption">
                    {[item.exerciseClass, item.mainMuscleGroups[0], item.equipment[0]].filter(Boolean).join(' · ')}
                  </ReedText>
                </View>
              </Pressable>

              <Pressable disabled={isWorking} onPress={() => onToggleSelected(item._id)} style={styles.catalogActionButton}>
                <Ionicons
                  color={String(isSelected ? theme.colors.accentPrimary : theme.colors.textMuted)}
                  name={isSelected ? 'checkmark' : 'add'}
                  size={18}
                />
              </Pressable>

              <Pressable disabled={isWorking} onPress={() => onToggleFavorite(item._id)} style={styles.catalogActionButton}>
                <Ionicons
                  color={String(item.isFavorite ? theme.colors.accentPrimary : theme.colors.textMuted)}
                  name={item.isFavorite ? 'star' : 'star-outline'}
                  size={18}
                />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FilterChip({
  isActive,
  label,
  onPress,
}: {
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useReedTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: isActive ? theme.colors.controlActiveFill : theme.colors.controlFill,
          borderColor: isActive ? theme.colors.controlActiveBorder : theme.colors.controlBorder,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <ReedText variant="caption">{label}</ReedText>
    </Pressable>
  );
}
