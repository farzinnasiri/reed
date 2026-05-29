import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Id } from '@/convex/_generated/dataModel';
import { getGlassControlTokens, getGlassPaneTokens, getGlassScrimTokens } from '@/components/ui/glass-material';
import { GlassSurface } from '@/components/ui/glass-surface';
import { blurActiveElementOnWeb } from '@/components/ui/focus';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { createTiming, getTapScaleStyle, reedEasing, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { styles } from './workout-surface.styles';
import type { CatalogItem, FilterOption } from './workout-surface.types';
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
  const safeAreaInsets = useSafeAreaInsets();
  const glassControls = getGlassControlTokens(theme);
  const scrim = getGlassScrimTokens(theme);
  const frostedSheetSurfaceStyle = useMemo(() => {
    const pane = getGlassPaneTokens(theme);
    return {
      backgroundColor: pane.backgroundColor,
      borderColor: pane.borderColor,
    };
  }, [theme]);
  const { height, width } = useWindowDimensions();
  const filterSheetHeight = getFilterSheetHeight({
    height,
    safeAreaBottom: safeAreaInsets.bottom,
    safeAreaTop: safeAreaInsets.top,
    width,
  });
  const sheetProgress = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const filterSheetProgress = useRef(new Animated.Value(0)).current;
  const {
    activeFilterCount,
    activeFilterSection,
    effectiveData,
    equipmentSearchText,
    hasSearchContext,
    muscleSearchText,
    resetSearchSession,
    searchText,
    selectedCount,
    selectedEquipment,
    selectedExerciseIds,
    selectedExerciseIdsSet,
    selectedFocusAreas,
    selectedTargetAreas,
    setActiveFilterSection,
    setEquipmentSearchText,
    setMuscleSearchText,
    setSearchText,
    setSelectedEquipment,
    setSelectedFocusAreas,
    setSelectedTargetAreas,
    toggleSelectedExercise,
  } = useAddExerciseSearchSession(isOpen);
  const [isSheetMounted, setIsSheetMounted] = useState(isOpen);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isFilterSheetMounted, setIsFilterSheetMounted] = useState(false);
  const [draftFocusAreas, setDraftFocusAreas] = useState<string[]>([]);
  const [draftTargetAreas, setDraftTargetAreas] = useState<string[]>([]);
  const [draftEquipment, setDraftEquipment] = useState<string[]>([]);
  const [expandedBodyAreas, setExpandedBodyAreas] = useState<string[]>([]);
  const [favoriteOverrides, setFavoriteOverrides] = useState<Partial<Record<Id<'exerciseCatalog'>, boolean>>>({});
  const draftFilterCount = draftFocusAreas.length + draftTargetAreas.length + draftEquipment.length;
  const draftFilterSectionOptions = useMemo(
    () => [
      {
        label: draftFocusAreas.length + draftTargetAreas.length > 0
          ? `Body (${draftFocusAreas.length + draftTargetAreas.length})`
          : 'Body',
        value: 'muscles' as const,
      },
      {
        label: draftEquipment.length > 0 ? `Equipment (${draftEquipment.length})` : 'Equipment',
        value: 'equipment' as const,
      },
    ],
    [draftEquipment.length, draftFocusAreas.length, draftTargetAreas.length],
  );
  const equipmentOptions = useMemo(
    () => (effectiveData?.equipmentOptions ?? []).map(value => ({ label: value, value })),
    [effectiveData?.equipmentOptions],
  );
  const filteredEquipmentOptions = useMemo(
    () => filterOptions(equipmentOptions, equipmentSearchText),
    [equipmentOptions, equipmentSearchText],
  );
  useEffect(() => {
    if (isOpen) {
      blurActiveElementOnWeb();
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
      setFavoriteOverrides({});
      setDraftFocusAreas([]);
      setDraftTargetAreas([]);
      setDraftEquipment([]);
      setExpandedBodyAreas([]);
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

  function handleToggleFavorite(exerciseCatalogId: Id<'exerciseCatalog'>, nextIsFavorite: boolean) {
    setFavoriteOverrides(current => ({
      ...current,
      [exerciseCatalogId]: nextIsFavorite,
    }));
    onToggleFavorite(exerciseCatalogId);
  }

  function applyFavoriteOverrides(items: CatalogItem[]) {
    return items.map(item => {
      const override = favoriteOverrides[item._id];
      return override == null ? item : { ...item, isFavorite: override };
    });
  }

  function openFilterSheet() {
    blurActiveElementOnWeb();
    setDraftFocusAreas(selectedFocusAreas);
    setDraftTargetAreas(selectedTargetAreas);
    setDraftEquipment(selectedEquipment);
    setExpandedBodyAreas(getExpandedBodyAreas(selectedFocusAreas, selectedTargetAreas, effectiveData?.targetAreaOptions ?? []));
    setMuscleSearchText('');
    setEquipmentSearchText('');
    setIsFilterSheetOpen(true);
  }

  function closeFilterSheet() {
    blurActiveElementOnWeb();
    setIsFilterSheetOpen(false);
  }

  function applyFilters() {
    blurActiveElementOnWeb();
    setSelectedFocusAreas(draftFocusAreas);
    setSelectedTargetAreas(draftTargetAreas);
    setSelectedEquipment(draftEquipment);
    setIsFilterSheetOpen(false);
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
                <View
                  style={[
                    styles.bulkAddHeaderSlot,
                    {
                      opacity: selectedCount > 0 ? 1 : 0,
                      pointerEvents: selectedCount > 0 ? 'auto' : 'none',
                    },
                  ]}
                >
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
                </View>

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
                    items={applyFavoriteOverrides(effectiveData?.results ?? [])}
                    onAddSingle={onAddSingle}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleSelected={toggleSelectedExercise}
                    selectedExerciseIds={selectedExerciseIdsSet}
                    title="Results"
                  />
                ) : (
                  <>
                    <CatalogSection
                      items={applyFavoriteOverrides(effectiveData?.recents ?? [])}
                      onAddSingle={onAddSingle}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSelected={toggleSelectedExercise}
                      selectedExerciseIds={selectedExerciseIdsSet}
                      title="Recents"
                    />
                    <CatalogSection
                      items={applyFavoriteOverrides(effectiveData?.favorites ?? [])}
                      onAddSingle={onAddSingle}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSelected={toggleSelectedExercise}
                      selectedExerciseIds={selectedExerciseIdsSet}
                      title="Favorites"
                    />
                    <CatalogSection
                      items={applyFavoriteOverrides(effectiveData?.suggested ?? [])}
                      onAddSingle={onAddSingle}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleSelected={toggleSelectedExercise}
                      selectedExerciseIds={selectedExerciseIdsSet}
                      title="Exercises"
                    />
                  </>
                )}
              </ScrollView>

              <View style={styles.sheetBottomDock}>
                <View style={styles.filterSummaryRow}>
                  <ReedText numberOfLines={1} style={styles.filterSummaryLine} tone="muted" variant="caption">
                    {buildFilterSummary({
                      focusOptions: effectiveData?.focusAreaOptions ?? [],
                      selectedEquipment,
                      selectedFocusAreas,
                      selectedTargetAreas,
                      targetOptions: effectiveData?.targetAreaOptions ?? [],
                    })}
                  </ReedText>
                  <Pressable
                    disabled={activeFilterCount === 0}
                    onPress={() => {
                      blurActiveElementOnWeb();
                      setSelectedFocusAreas([]);
                      setSelectedTargetAreas([]);
                      setSelectedEquipment([]);
                      setDraftFocusAreas([]);
                      setDraftTargetAreas([]);
                      setDraftEquipment([]);
                      setExpandedBodyAreas([]);
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
                    onPress={openFilterSheet}
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
        </Animated.View>

        {isFilterSheetMounted ? (
          <Animated.View style={[styles.filterSheetOverlay, { opacity: filterOverlayOpacity }]}>
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: scrim.backgroundColor, pointerEvents: 'none' },
              ]}
            />
            <Pressable onPress={closeFilterSheet} style={styles.filterSheetBackdropPressable} />
            <Animated.View
              style={[
                styles.filterSheetPanelFrame,
                {
                  height: filterSheetHeight,
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
                    onPress={closeFilterSheet}
                    style={({ pressed }) => [styles.sheetClose, getTapScaleStyle(pressed)]}
                  >
                    <Ionicons color={String(theme.colors.textMuted)} name="close" size={18} />
                  </Pressable>
                </View>

                <View style={styles.filterSheetTabs}>
                  <SegmentedControl<AddExerciseFilterSectionKey>
                    compact
                    onChange={setActiveFilterSection}
                    options={draftFilterSectionOptions}
                    value={activeFilterSection}
                  />
                </View>

                <ScrollView
                  contentContainerStyle={styles.filterSheetBody}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={styles.filterSheetScroll}
                >
                  {activeFilterSection === 'muscles' ? (
                    <BodyAreaTreeSection
                      focusOptions={effectiveData?.focusAreaOptions ?? effectiveData?.muscleGroupOptions ?? []}
                      onClear={() => {
                        setDraftFocusAreas([]);
                        setDraftTargetAreas([]);
                      }}
                      onToggleExpanded={value => toggleFilterValue(value, setExpandedBodyAreas)}
                      onToggleFocus={value => toggleDraftFocusArea(value, setDraftFocusAreas, setDraftTargetAreas, effectiveData?.targetAreaOptions ?? [])}
                      onToggleTarget={value => toggleDraftTargetArea(value, setDraftFocusAreas, setDraftTargetAreas, effectiveData?.targetAreaOptions ?? [])}
                      onSearchChange={setMuscleSearchText}
                      expandedFocusAreas={expandedBodyAreas}
                      searchText={muscleSearchText}
                      selectedFocusAreas={draftFocusAreas}
                      selectedTargetAreas={draftTargetAreas}
                      targetOptions={effectiveData?.targetAreaOptions ?? []}
                    />
                  ) : null}

                  {activeFilterSection === 'equipment' ? (
                    <FilterSection
                      emptyLabel="No equipment found."
                      onClear={() => setDraftEquipment([])}
                      onSearchChange={setEquipmentSearchText}
                      onToggle={value => toggleFilterValue(value, setDraftEquipment)}
                      options={filteredEquipmentOptions}
                      searchText={equipmentSearchText}
                      selectedCount={draftEquipment.length}
                      subtitle="Pick one or more equipment options."
                      title="Equipment"
                      valueIsSelected={value => draftEquipment.includes(value)}
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
                    {buildFilterSummary({
                      focusOptions: effectiveData?.focusAreaOptions ?? [],
                      selectedEquipment: draftEquipment,
                      selectedFocusAreas: draftFocusAreas,
                      selectedTargetAreas: draftTargetAreas,
                      targetOptions: effectiveData?.targetAreaOptions ?? [],
                    })}
                  </ReedText>

                  <View style={styles.filterSheetFooterActions}>
                    <Pressable
                      disabled={draftFilterCount === 0}
                      onPress={() => {
                        blurActiveElementOnWeb();
                        setDraftFocusAreas([]);
                        setDraftTargetAreas([]);
                        setDraftEquipment([]);
                        setExpandedBodyAreas([]);
                        setMuscleSearchText('');
                        setEquipmentSearchText('');
                      }}
                      style={({ pressed }) => [
                        styles.filterFooterSecondaryButton,
                        {
                          backgroundColor: glassControls.shellBackgroundColor,
                          borderColor: glassControls.shellBorderColor,
                          ...getTapScaleStyle(pressed, draftFilterCount === 0),
                        },
                      ]}
                    >
                      <ReedText tone={draftFilterCount === 0 ? 'muted' : 'default'} variant="caption">Reset</ReedText>
                    </Pressable>

                    <Pressable
                      onPress={applyFilters}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CatalogSection({
  items,
  onAddSingle,
  onToggleSelected,
  onToggleFavorite,
  selectedExerciseIds,
  title,
}: {
  items: CatalogItem[];
  onAddSingle: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  onToggleSelected: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  onToggleFavorite: (exerciseCatalogId: Id<'exerciseCatalog'>, nextIsFavorite: boolean) => void;
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
                onPress={() => onAddSingle(item._id)}
                style={({ pressed }) => [styles.catalogRowPressable, getTapScaleStyle(pressed)]}
              >
                <View style={styles.catalogRowCopy}>
                  <ReedText numberOfLines={1} variant="bodyStrong">
                    {item.name}
                  </ReedText>
                  <ReedText numberOfLines={1} tone="muted" variant="caption">
                    {[item.exerciseClass, item.primaryTargetAreaLabels[0] ?? item.primaryFocusAreaLabels[0] ?? item.mainMuscleGroups[0], item.equipment[0]].filter(Boolean).join(' · ')}
                  </ReedText>
                </View>
              </Pressable>

              <Pressable
                onPress={() => onToggleSelected(item._id)}
                style={({ pressed }) => [styles.catalogActionButton, getTapScaleStyle(pressed)]}
              >
                <Ionicons
                  color={String(isSelected ? theme.colors.accentPrimary : theme.colors.textMuted)}
                  name={isSelected ? 'checkmark' : 'add'}
                  size={18}
                />
              </Pressable>

              <Pressable
                onPress={() => onToggleFavorite(item._id, !item.isFavorite)}
                style={({ pressed }) => [styles.catalogActionButton, getTapScaleStyle(pressed)]}
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
  options: FilterOption[];
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
            const isSelected = valueIsSelected(option.value);

            return (
              <Pressable
                key={option.value}
                onPress={() => onToggle(option.value)}
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
                  {option.label}
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

function BodyAreaTreeSection({
  expandedFocusAreas,
  focusOptions,
  onClear,
  onSearchChange,
  onToggleExpanded,
  onToggleFocus,
  onToggleTarget,
  searchText,
  selectedFocusAreas,
  selectedTargetAreas,
  targetOptions,
}: {
  expandedFocusAreas: string[];
  focusOptions: FilterOption[];
  onClear: () => void;
  onSearchChange: (value: string) => void;
  onToggleExpanded: (value: string) => void;
  onToggleFocus: (value: string) => void;
  onToggleTarget: (value: string) => void;
  searchText: string;
  selectedFocusAreas: string[];
  selectedTargetAreas: string[];
  targetOptions: FilterOption[];
}) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);
  const selectedCount = selectedFocusAreas.length + selectedTargetAreas.length;
  const visibleRows = buildBodyAreaTreeRows(focusOptions, targetOptions, searchText);
  const queryText = searchText.trim();

  return (
    <View style={styles.filterSectionBlock}>
      <View style={styles.filterSectionHeaderRow}>
        <View style={styles.filterSectionHeaderCopy}>
          <ReedText variant="bodyStrong">Body area</ReedText>
          <ReedText tone="muted" variant="caption">
            Pick a broad area or open it for a narrower choice.
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
          placeholder="Find body area"
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
        {visibleRows.length === 0 ? (
          <ReedText tone="muted" variant="caption">
            No body areas found.
          </ReedText>
        ) : (
          visibleRows.map(row => {
            const isParentSelected = selectedFocusAreas.includes(row.focus.value);
            const isExpanded = queryText.length > 0 || expandedFocusAreas.includes(row.focus.value);
            const selectedChildCount = row.visibleChildren.filter(child => selectedTargetAreas.includes(child.value)).length;
            const childOptions = isExpanded ? row.visibleChildren : [];

            return (
              <View key={row.focus.value} style={styles.filterTreeGroup}>
                <View
                  style={[
                    styles.filterOptionRow,
                    {
                      backgroundColor: isParentSelected ? glassControls.activeBackgroundColor : glassControls.shellBackgroundColor,
                      borderColor: isParentSelected ? glassControls.activeBorderColor : glassControls.shellBorderColor,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => onToggleFocus(row.focus.value)}
                    style={({ pressed }) => [styles.filterTreeParentToggle, getTapScaleStyle(pressed)]}
                  >
                    <ReedText numberOfLines={1} style={styles.filterOptionLabel} variant="body">
                      {row.focus.label}
                    </ReedText>
                    {selectedChildCount > 0 && !isParentSelected ? (
                      <ReedText style={styles.filterTreeCount} tone="muted" variant="caption">
                        {selectedChildCount}
                      </ReedText>
                    ) : null}
                  </Pressable>
                  {row.hasChildren ? (
                    <Pressable
                      onPress={() => onToggleExpanded(row.focus.value)}
                      style={({ pressed }) => [styles.filterTreeDisclosure, getTapScaleStyle(pressed)]}
                    >
                      <Ionicons
                        color={String(theme.colors.textMuted)}
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                      />
                    </Pressable>
                  ) : null}
                  <Ionicons
                    color={String(isParentSelected ? theme.colors.accentPrimary : theme.colors.textMuted)}
                    name={isParentSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                  />
                </View>

                {childOptions.length > 0 ? (
                  <View style={styles.filterTreeChildren}>
                    {childOptions.map(child => {
                      const isChildSelected = isParentSelected || selectedTargetAreas.includes(child.value);

                      return (
                        <Pressable
                          key={child.value}
                          onPress={() => onToggleTarget(child.value)}
                          style={({ pressed }) => [
                            styles.filterTreeChildRow,
                            {
                              backgroundColor: isChildSelected ? glassControls.activeBackgroundColor : glassControls.shellBackgroundColor,
                              borderColor: isChildSelected ? glassControls.activeBorderColor : glassControls.shellBorderColor,
                              ...getTapScaleStyle(pressed),
                            },
                          ]}
                        >
                          <ReedText numberOfLines={1} style={styles.filterOptionLabel} variant="caption">
                            {child.label}
                          </ReedText>
                          <Ionicons
                            color={String(isChildSelected ? theme.colors.accentPrimary : theme.colors.textMuted)}
                            name={isChildSelected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={17}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function filterOptions(options: FilterOption[], query: string) {
  const queryText = query.trim().toLowerCase();
  if (!queryText) {
    return options;
  }

  return options.filter(option => option.label.toLowerCase().includes(queryText));
}

function toggleFilterValue(
  value: string,
  setValues: (updater: (current: string[]) => string[]) => void,
) {
  setValues(current =>
    current.includes(value) ? current.filter(existing => existing !== value) : [...current, value],
  );
}

function toggleDraftFocusArea(
  value: string,
  setFocusAreas: (updater: (current: string[]) => string[]) => void,
  setTargetAreas: (updater: (current: string[]) => string[]) => void,
  targetOptions: FilterOption[],
) {
  setFocusAreas(current => {
    const isSelected = current.includes(value);
    const next = isSelected ? current.filter(existing => existing !== value) : [...current, value];
    setTargetAreas(targets => removeTargetsForFocus(targets, value, targetOptions));
    return next;
  });
}

function toggleDraftTargetArea(
  value: string,
  setFocusAreas: (updater: (current: string[]) => string[]) => void,
  setTargetAreas: (updater: (current: string[]) => string[]) => void,
  targetOptions: FilterOption[],
) {
  const option = targetOptions.find(candidate => candidate.value === value);
  const parentFocusAreas = option?.parentFocusAreas ?? [];

  setFocusAreas(current => current.filter(focus => !parentFocusAreas.includes(focus)));
  setTargetAreas(current =>
    current.includes(value) ? current.filter(existing => existing !== value) : [...current, value],
  );
}

function removeTargetsForFocus(targets: string[], focusArea: string, targetOptions: FilterOption[]) {
  return targets.filter(target => {
    const option = targetOptions.find(candidate => candidate.value === target);
    return !(option?.parentFocusAreas?.includes(focusArea) ?? false);
  });
}

function getExpandedBodyAreas(
  selectedFocusAreas: string[],
  selectedTargetAreas: string[],
  targetOptions: FilterOption[],
) {
  const expanded = new Set(selectedFocusAreas);

  for (const target of selectedTargetAreas) {
    const option = targetOptions.find(candidate => candidate.value === target);
    for (const parent of option?.parentFocusAreas ?? []) {
      expanded.add(parent);
    }
  }

  return Array.from(expanded);
}

function buildBodyAreaTreeRows(focusOptions: FilterOption[], targetOptions: FilterOption[], query: string) {
  const queryText = query.trim().toLowerCase();

  return focusOptions
    .map(focus => {
      const children = targetOptions.filter(option => option.parentFocusAreas?.includes(focus.value));
      const matchingChildren = queryText.length === 0
        ? children
        : children.filter(option => option.label.toLowerCase().includes(queryText));
      const focusMatches = queryText.length === 0 || focus.label.toLowerCase().includes(queryText);
      const visibleChildren = queryText.length === 0 || focusMatches ? children : matchingChildren;

      if (!focusMatches && matchingChildren.length === 0) {
        return null;
      }

      return {
        focus,
        hasChildren: children.length > 0,
        visibleChildren,
      };
    })
    .filter(isTreeRow);
}

function isTreeRow(
  row: { focus: FilterOption; hasChildren: boolean; visibleChildren: FilterOption[] } | null,
): row is { focus: FilterOption; hasChildren: boolean; visibleChildren: FilterOption[] } {
  return row !== null;
}

function getFilterSheetHeight({
  height,
  safeAreaBottom,
  safeAreaTop,
  width,
}: {
  height: number;
  safeAreaBottom: number;
  safeAreaTop: number;
  width: number;
}) {
  const availableHeight = Math.max(320, height - safeAreaTop - safeAreaBottom);
  const isLandscapeOrTablet = width >= height || width >= 720;
  const heightRatio = height < 700 ? 0.9 : isLandscapeOrTablet ? 0.72 : 0.82;
  const maxHeight = isLandscapeOrTablet ? 680 : 760;

  return Math.round(Math.min(maxHeight, Math.max(360, availableHeight * heightRatio)));
}

function buildFilterSummary({
  focusOptions,
  selectedEquipment,
  selectedFocusAreas,
  selectedTargetAreas,
  targetOptions,
}: {
  focusOptions: FilterOption[];
  selectedEquipment: string[];
  selectedFocusAreas: string[];
  selectedTargetAreas: string[];
  targetOptions: FilterOption[];
}) {
  const focusLabels = selectedFocusAreas.map(
    value => focusOptions.find(option => option.value === value)?.label ?? value,
  );
  const targetLabels = selectedTargetAreas.map(
    value => targetOptions.find(option => option.value === value)?.label ?? value,
  );
  const focusAndTargetLabels = [...focusLabels, ...targetLabels];
  const focusPart =
    focusAndTargetLabels.length === 0
      ? 'Any body area'
      : focusAndTargetLabels.length <= 2
        ? focusAndTargetLabels.join(' + ')
        : `${focusAndTargetLabels.length} body filters`;
  const equipmentPart =
    selectedEquipment.length === 0
      ? 'Any equipment'
      : selectedEquipment.length <= 2
        ? selectedEquipment.join(' + ')
        : `${selectedEquipment.length} equipment`;

  return `${focusPart} • ${equipmentPart}`;
}
