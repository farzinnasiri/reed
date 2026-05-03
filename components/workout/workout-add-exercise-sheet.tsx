import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import type { Id } from '@/convex/_generated/dataModel';
import { getGlassControlTokens, getGlassPaneTokens, getGlassScrimTokens } from '@/components/ui/glass-material';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { createTiming, getTapScaleStyle, reedEasing, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { styles } from './workout-surface.styles';
import type { CatalogItem } from './workout-surface.types';
import { useAddExerciseSearchSession, type AddExerciseFilterSectionKey } from './use-add-exercise-search-session';

type AddExerciseSheetProps = {
  isOpen: boolean;
  isWorking: boolean;
  onAddBulk: (exerciseCatalogIds: Id<'exerciseCatalog'>[]) => void;
  onAddSingle: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  onClose: () => void;
  onToggleFavorite: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
};

export function AddExerciseSheet({
  isOpen,
  isWorking,
  onAddBulk,
  onAddSingle,
  onClose,
  onToggleFavorite,
}: AddExerciseSheetProps) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);
  const scrim = getGlassScrimTokens(theme);
  const frostedSheetSurfaceStyle = useMemo(() => {
    const pane = getGlassPaneTokens(theme);
    return {
      backgroundColor: pane.backgroundColor,
      borderColor: pane.borderColor,
    };
  }, [theme]);
  const { height } = useWindowDimensions();
  const sheetProgress = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const filterSheetProgress = useRef(new Animated.Value(0)).current;
  const {
    activeFilterCount,
    activeFilterSection,
    effectiveData,
    equipmentSearchText,
    filterSectionOptions,
    hasSearchContext,
    muscleSearchText,
    resetSearchSession,
    searchText,
    selectedCount,
    selectedEquipment,
    selectedExerciseIds,
    selectedExerciseIdsSet,
    selectedMuscleGroups,
    setActiveFilterSection,
    setEquipmentSearchText,
    setMuscleSearchText,
    setSearchText,
    setSelectedEquipment,
    setSelectedMuscleGroups,
    toggleSelectedExercise,
  } = useAddExerciseSearchSession(isOpen);
  const [isSheetMounted, setIsSheetMounted] = useState(isOpen);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isFilterSheetMounted, setIsFilterSheetMounted] = useState(false);
  const filteredMuscleOptions = useMemo(
    () => filterOptions(effectiveData?.muscleGroupOptions ?? [], muscleSearchText),
    [effectiveData?.muscleGroupOptions, muscleSearchText],
  );
  const filteredEquipmentOptions = useMemo(
    () => filterOptions(effectiveData?.equipmentOptions ?? [], equipmentSearchText),
    [effectiveData?.equipmentOptions, equipmentSearchText],
  );
  useEffect(() => {
    if (isOpen) {
      setIsSheetMounted(true);
      requestAnimationFrame(() => {
        createTiming(sheetProgress, 1, reedMotion.durations.mode, reedEasing.easeOut).start();
      });
      return;
    }

    setIsFilterSheetOpen(false);
    createTiming(sheetProgress, 0, reedMotion.durations.mode, reedEasing.easeInOut).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setIsSheetMounted(false);
      resetSearchSession();
    });
  }, [isOpen, sheetProgress]);

  useEffect(() => {
    if (isFilterSheetOpen) {
      setIsFilterSheetMounted(true);
      requestAnimationFrame(() => {
        createTiming(filterSheetProgress, 1, reedMotion.durations.mode, reedEasing.easeOut).start();
      });
      return;
    }

    createTiming(filterSheetProgress, 0, reedMotion.durations.mode, reedEasing.easeInOut).start(({ finished }) => {
      if (finished) {
        setIsFilterSheetMounted(false);
      }
    });
  }, [filterSheetProgress, isFilterSheetOpen]);

  function handleAddBulk() {
    if (selectedExerciseIds.length === 0 || isWorking) {
      return;
    }

    onAddBulk(selectedExerciseIds);
  }

  if (!isSheetMounted) {
    return null;
  }

  const overlayOpacity = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const panelTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });
  const filterOverlayOpacity = filterSheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const filterTranslateY = filterSheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [height * 0.5, 0],
  });

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={isSheetMounted}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetOverlay}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: scrim.backgroundColor, opacity: overlayOpacity, pointerEvents: 'none' },
          ]}
        />
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[
            styles.sheetPanelFrame,
            {
              transform: [{ translateY: panelTranslateY }],
            },
          ]}
        >
          <GlassSurface
            contentStyle={styles.sheetPanelContent}
            style={[styles.sheetPanel, frostedSheetSurfaceStyle]}
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
                        ...getTapScaleStyle(pressed, isWorking),
                      },
                    ]}
                  >
                    <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
                      {isWorking ? 'Adding…' : `Add ${selectedCount}`}
                    </ReedText>
                  </Pressable>
                ) : null}

                <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetClose, getTapScaleStyle(pressed)]}>
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
                {hasSearchContext ? (
                  <CatalogSection
                    isWorking={isWorking}
                    items={effectiveData?.results ?? []}
                    onAddSingle={onAddSingle}
                    onToggleFavorite={onToggleFavorite}
                    onToggleSelected={toggleSelectedExercise}
                    selectedExerciseIds={selectedExerciseIdsSet}
                    title="Results"
                  />
                ) : (
                  <>
                    <CatalogSection
                      isWorking={isWorking}
                      items={effectiveData?.recents ?? []}
                      onAddSingle={onAddSingle}
                      onToggleFavorite={onToggleFavorite}
                      onToggleSelected={toggleSelectedExercise}
                      selectedExerciseIds={selectedExerciseIdsSet}
                      title="Recents"
                    />
                    <CatalogSection
                      isWorking={isWorking}
                      items={effectiveData?.favorites ?? []}
                      onAddSingle={onAddSingle}
                      onToggleFavorite={onToggleFavorite}
                      onToggleSelected={toggleSelectedExercise}
                      selectedExerciseIds={selectedExerciseIdsSet}
                      title="Favorites"
                    />
                  </>
                )}
              </ScrollView>

              <View style={styles.sheetBottomDock}>
                <View style={styles.filterSummaryRow}>
                  <ReedText numberOfLines={1} style={styles.filterSummaryLine} tone="muted" variant="caption">
                    {buildFilterSummary({ selectedEquipment, selectedMuscleGroups })}
                  </ReedText>
                  <Pressable
                    disabled={activeFilterCount === 0}
                    onPress={() => {
                      setSelectedMuscleGroups([]);
                      setSelectedEquipment([]);
                    }}
                    style={({ pressed }) => [styles.filterSummaryClear, getTapScaleStyle(pressed, activeFilterCount === 0)]}
                  >
                    <ReedText tone={activeFilterCount === 0 ? 'muted' : 'default'} variant="caption">
                      Clear
                    </ReedText>
                  </Pressable>
                </View>

                <View
                  style={[
                    styles.searchShell,
                    {
                      backgroundColor: glassControls.shellBackgroundColor,
                      borderColor: glassControls.shellBorderColor,
                    },
                  ]}
                >
                  <Ionicons color={String(theme.colors.textMuted)} name="search" size={16} />
                  <TextInput
                    onChangeText={setSearchText}
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

                  <View
                    style={[
                      styles.searchFilterDivider,
                      {
                        backgroundColor: glassControls.shellBorderColor,
                      },
                    ]}
                  />

                  <Pressable
                    onPress={() => setIsFilterSheetOpen(true)}
                    style={({ pressed }) => [
                      styles.searchFilterButton,
                      getTapScaleStyle(pressed),
                    ]}
                  >
                    <Ionicons color={String(theme.colors.textMuted)} name="options-outline" size={18} />
                    <ReedText variant="caption">Filters</ReedText>
                    {activeFilterCount > 0 ? (
                      <View
                        style={[
                          styles.searchFilterBadge,
                          {
                            backgroundColor: theme.colors.accentPrimary,
                          },
                        ]}
                      >
                        <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="caption">
                          {activeFilterCount}
                        </ReedText>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              </View>
            </View>
          </GlassSurface>

          {isFilterSheetMounted ? (
            <Animated.View style={[styles.filterSheetOverlay, { opacity: filterOverlayOpacity }]}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: scrim.backgroundColor, pointerEvents: 'none' },
                ]}
              />
              <Pressable onPress={() => setIsFilterSheetOpen(false)} style={StyleSheet.absoluteFill} />
              <Animated.View
                style={[
                  styles.filterSheetPanelFrame,
                  {
                    transform: [{ translateY: filterTranslateY }],
                  },
                ]}
              >
                <GlassSurface
                  contentStyle={styles.filterSheetPanelContent}
                  style={[styles.filterSheetPanel, frostedSheetSurfaceStyle]}
                >
                  <View style={styles.filterSheetHeader}>
                    <ReedText variant="section">Filters</ReedText>
                    <Pressable
                      onPress={() => setIsFilterSheetOpen(false)}
                      style={({ pressed }) => [styles.sheetClose, getTapScaleStyle(pressed)]}
                    >
                      <Ionicons color={String(theme.colors.textMuted)} name="close" size={18} />
                    </Pressable>
                  </View>

                  <View style={styles.filterSheetTabs}>
                    <SegmentedControl<AddExerciseFilterSectionKey>
                      compact
                      onChange={setActiveFilterSection}
                      options={filterSectionOptions}
                      value={activeFilterSection}
                    />
                  </View>

                  <ScrollView contentContainerStyle={styles.filterSheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {activeFilterSection === 'muscles' ? (
                      <FilterSection
                        emptyLabel="No muscles found."
                        onClear={() => setSelectedMuscleGroups([])}
                        onSearchChange={setMuscleSearchText}
                        onToggle={value => toggleFilterValue(value, setSelectedMuscleGroups)}
                        options={filteredMuscleOptions}
                        searchText={muscleSearchText}
                        selectedCount={selectedMuscleGroups.length}
                        subtitle="Pick one or more muscle groups."
                        title="Muscles"
                        valueIsSelected={value => selectedMuscleGroups.includes(value)}
                      />
                    ) : null}

                    {activeFilterSection === 'equipment' ? (
                      <FilterSection
                        emptyLabel="No equipment found."
                        onClear={() => setSelectedEquipment([])}
                        onSearchChange={setEquipmentSearchText}
                        onToggle={value => toggleFilterValue(value, setSelectedEquipment)}
                        options={filteredEquipmentOptions}
                        searchText={equipmentSearchText}
                        selectedCount={selectedEquipment.length}
                        subtitle="Pick one or more equipment options."
                        title="Equipment"
                        valueIsSelected={value => selectedEquipment.includes(value)}
                      />
                    ) : null}

                  </ScrollView>

                  <View
                    style={[
                      styles.filterSheetFooter,
                      {
                        borderTopColor: glassControls.shellBorderColor,
                      },
                    ]}
                  >
                    <ReedText numberOfLines={2} style={styles.filterSheetFooterSummary} tone="muted" variant="caption">
                      {buildFilterSummary({ selectedEquipment, selectedMuscleGroups })}
                    </ReedText>

                    <View style={styles.filterSheetFooterActions}>
                      <Pressable
                        onPress={() => {
                          setSelectedMuscleGroups([]);
                          setSelectedEquipment([]);
                          setMuscleSearchText('');
                          setEquipmentSearchText('');
                        }}
                        style={({ pressed }) => [
                          styles.filterFooterSecondaryButton,
                          {
                            backgroundColor: glassControls.shellBackgroundColor,
                            borderColor: glassControls.shellBorderColor,
                            ...getTapScaleStyle(pressed),
                          },
                        ]}
                      >
                        <ReedText variant="caption">Reset</ReedText>
                      </Pressable>

                      <Pressable
                        onPress={() => setIsFilterSheetOpen(false)}
                        style={({ pressed }) => [
                          styles.filterFooterPrimaryButton,
                          {
                            backgroundColor: theme.colors.accentPrimary,
                            ...getTapScaleStyle(pressed),
                          },
                        ]}
                      >
                        <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="caption">
                          Apply
                        </ReedText>
                      </Pressable>
                    </View>
                  </View>
                </GlassSurface>
              </Animated.View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
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
              <Pressable
                disabled={isWorking}
                onPress={() => onAddSingle(item._id)}
                style={({ pressed }) => [styles.catalogRowPressable, getTapScaleStyle(pressed, isWorking)]}
              >
                <View style={styles.catalogRowCopy}>
                  <ReedText numberOfLines={1} variant="bodyStrong">
                    {item.name}
                  </ReedText>
                  <ReedText numberOfLines={1} tone="muted" variant="caption">
                    {[item.exerciseClass, item.mainMuscleGroups[0], item.equipment[0]].filter(Boolean).join(' · ')}
                  </ReedText>
                </View>
              </Pressable>

              <Pressable
                disabled={isWorking}
                onPress={() => onToggleSelected(item._id)}
                style={({ pressed }) => [styles.catalogActionButton, getTapScaleStyle(pressed, isWorking)]}
              >
                <Ionicons
                  color={String(isSelected ? theme.colors.accentPrimary : theme.colors.textMuted)}
                  name={isSelected ? 'checkmark' : 'add'}
                  size={18}
                />
              </Pressable>

              <Pressable
                disabled={isWorking}
                onPress={() => onToggleFavorite(item._id)}
                style={({ pressed }) => [styles.catalogActionButton, getTapScaleStyle(pressed, isWorking)]}
              >
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

function FilterSection({
  emptyLabel,
  onClear,
  onSearchChange,
  onToggle,
  options,
  searchText,
  selectedCount,
  subtitle,
  title,
  valueIsSelected,
}: {
  emptyLabel: string;
  onClear: () => void;
  onSearchChange: (value: string) => void;
  onToggle: (value: string) => void;
  options: string[];
  searchText: string;
  selectedCount: number;
  subtitle: string;
  title: string;
  valueIsSelected: (value: string) => boolean;
}) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);

  return (
    <View style={styles.filterSectionBlock}>
      <View style={styles.filterSectionHeaderRow}>
        <View style={styles.filterSectionHeaderCopy}>
          <ReedText variant="bodyStrong">{title}</ReedText>
          <ReedText tone="muted" variant="caption">
            {subtitle}
          </ReedText>
        </View>
        <Pressable
          disabled={selectedCount === 0}
          onPress={onClear}
          style={({ pressed }) => [getTapScaleStyle(pressed, selectedCount === 0)]}
        >
          <ReedText tone={selectedCount === 0 ? 'muted' : 'default'} variant="caption">
            Clear
          </ReedText>
        </Pressable>
      </View>

      <View
        style={[
          styles.filterSearchShell,
          {
            backgroundColor: glassControls.shellBackgroundColor,
            borderColor: glassControls.shellBorderColor,
          },
        ]}
      >
        <Ionicons color={String(theme.colors.textMuted)} name="search" size={14} />
        <TextInput
          onChangeText={onSearchChange}
          placeholder={`Find ${title.toLowerCase()}`}
          placeholderTextColor={String(theme.colors.textMuted)}
          style={[
            styles.filterSearchInput,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.body.fontFamily,
            },
          ]}
          value={searchText}
        />
      </View>

      <View style={styles.filterOptionsList}>
        {options.length === 0 ? (
          <ReedText tone="muted" variant="caption">
            {emptyLabel}
          </ReedText>
        ) : (
          options.map(option => {
            const isSelected = valueIsSelected(option);

            return (
              <Pressable
                key={option}
                onPress={() => onToggle(option)}
                style={({ pressed }) => [
                  styles.filterOptionRow,
                  {
                    backgroundColor: isSelected ? glassControls.activeBackgroundColor : glassControls.shellBackgroundColor,
                    borderColor: isSelected ? glassControls.activeBorderColor : glassControls.shellBorderColor,
                    ...getTapScaleStyle(pressed),
                  },
                ]}
              >
                <ReedText numberOfLines={1} style={styles.filterOptionLabel} variant="body">
                  {option}
                </ReedText>
                <Ionicons
                  color={String(isSelected ? theme.colors.accentPrimary : theme.colors.textMuted)}
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                />
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

function filterOptions(options: string[], query: string) {
  const queryText = query.trim().toLowerCase();
  if (!queryText) {
    return options;
  }

  return options.filter(option => option.toLowerCase().includes(queryText));
}

function toggleFilterValue(
  value: string,
  setValues: (updater: (current: string[]) => string[]) => void,
) {
  setValues(current =>
    current.includes(value) ? current.filter(existing => existing !== value) : [...current, value],
  );
}

function buildFilterSummary({
  selectedEquipment,
  selectedMuscleGroups,
}: {
  selectedEquipment: string[];
  selectedMuscleGroups: string[];
}) {
  const musclePart =
    selectedMuscleGroups.length === 0
      ? 'Any muscle'
      : selectedMuscleGroups.length <= 2
        ? selectedMuscleGroups.join(' + ')
        : `${selectedMuscleGroups.length} muscles`;
  const equipmentPart =
    selectedEquipment.length === 0
      ? 'Any equipment'
      : selectedEquipment.length <= 2
        ? selectedEquipment.join(' + ')
        : `${selectedEquipment.length} equipment`;

  return `${musclePart} • ${equipmentPart}`;
}
