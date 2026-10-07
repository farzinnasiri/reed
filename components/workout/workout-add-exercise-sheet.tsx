import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Id } from '@/convex/_generated/dataModel';
import { bareInputStyle, blurActiveElementOnWeb } from '@/components/ui/focus';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedSheetTextInput } from '@/components/ui/reed-sheet-input';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { styles } from './workout-add-exercise-sheet.styles';
import type { CatalogItem, FilterOption } from './workout-surface.types';
import { useAddExerciseSearchSession, type AddExerciseFilterSectionKey } from './use-add-exercise-search-session';

// One height for browsing and for filters, so opening the filters never resizes the sheet.
const SHEET_FRACTION = 0.9;

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
  const insets = useSafeAreaInsets();
  const {
    activeFilterCount,
    activeFilterSection,
    effectiveData,
    equipmentSearchText,
    hasSearchContext,
    hasMoreResults,
    isLoadingMoreResults,
    loadMoreResults,
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
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [draftFocusAreas, setDraftFocusAreas] = useState<string[]>([]);
  const [draftTargetAreas, setDraftTargetAreas] = useState<string[]>([]);
  const [draftEquipment, setDraftEquipment] = useState<string[]>([]);
  const [expandedBodyAreas, setExpandedBodyAreas] = useState<string[]>([]);
  const [favoriteOverrides, setFavoriteOverrides] = useState<Partial<Record<Id<'exerciseCatalog'>, boolean>>>({});
  const [exerciseListTab, setExerciseListTab] = useState<'favorites' | 'recents'>('favorites');
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) { setExerciseListTab('favorites'); setIsFilterSheetOpen(false); }
  }
  const draftFilterCount = draftFocusAreas.length + draftTargetAreas.length + draftEquipment.length;
  const searchResults = applyFavoriteOverrides(effectiveData?.results ?? []);
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
  // Everything the sheet held is dropped when it closes, however it closed.
  function handleDismiss() {
    setFavoriteOverrides({});
    setDraftFocusAreas([]);
    setDraftTargetAreas([]);
    setDraftEquipment([]);
    setExpandedBodyAreas([]);
    resetSearchSession();
    onClose();
  }

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

  const gutter = theme.spacing.gutter;
  const filterSummary = buildFilterSummary({
    focusOptions: effectiveData?.focusAreaOptions ?? [],
    selectedEquipment,
    selectedFocusAreas,
    selectedTargetAreas,
    targetOptions: effectiveData?.targetAreaOptions ?? [],
  });
  const browseItems = (items: CatalogItem[] | undefined) => applyFavoriteOverrides(items ?? []);

  return (
    <ReedSheet heightFraction={SHEET_FRACTION} onBack={isFilterSheetOpen ? closeFilterSheet : undefined} onDismiss={handleDismiss} open={isOpen}>
      <View style={styles.sheet}>
        {isFilterSheetOpen ? (
          <>
            <View style={[styles.sheetHeader, { paddingHorizontal: gutter }]}>
              <ReedIconButton accessibilityLabel="Back to exercises" onPress={closeFilterSheet} variant="ghost">
                <Ionicons color={String(theme.colors.inkSecondary)} name="chevron-back" size={22} />
              </ReedIconButton>
              <ReedText style={styles.sheetTitle} variant="headline">Filters</ReedText>
            </View>

            <View style={{ paddingHorizontal: gutter }}>
              <SegmentedControl<AddExerciseFilterSectionKey>
                compact
                onChange={setActiveFilterSection}
                options={draftFilterSectionOptions}
                value={activeFilterSection}
              />
            </View>

            <BottomSheetScrollView
              contentContainerStyle={{ paddingBottom: theme.spacing.md, paddingHorizontal: gutter, paddingTop: theme.spacing.xs }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
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
            </BottomSheetScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md, paddingHorizontal: gutter }]}>
              <ReedText numberOfLines={2} tone="muted" variant="caption">
                {buildFilterSummary({
                  focusOptions: effectiveData?.focusAreaOptions ?? [],
                  selectedEquipment: draftEquipment,
                  selectedFocusAreas: draftFocusAreas,
                  selectedTargetAreas: draftTargetAreas,
                  targetOptions: effectiveData?.targetAreaOptions ?? [],
                })}
              </ReedText>
              <View style={styles.footerActions}>
                <ReedButton
                  disabled={draftFilterCount === 0}
                  label="Reset"
                  onPress={() => {
                    blurActiveElementOnWeb();
                    setDraftFocusAreas([]);
                    setDraftTargetAreas([]);
                    setDraftEquipment([]);
                    setExpandedBodyAreas([]);
                    setMuscleSearchText('');
                    setEquipmentSearchText('');
                  }}
                  variant="quiet"
                />
                <View style={styles.footerPrimary}><ReedButton label="Apply" onPress={applyFilters} /></View>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.sheetHeader, { paddingHorizontal: gutter }]}>
              <ReedText style={styles.sheetTitle} variant="title">Add exercise</ReedText>
              {selectedCount > 0 ? (
                <ReedButton
                  disabled={isWorking}
                  label={isWorking ? 'Adding…' : `Add ${selectedCount}`}
                  onPress={handleAddBulk}
                  variant="soft"
                />
              ) : null}
              <ReedIconButton accessibilityLabel="Close add exercise" onPress={onClose} variant="ghost">
                <Ionicons color={String(theme.colors.inkSecondary)} name="close" size={22} />
              </ReedIconButton>
            </View>

            {hasSearchContext ? (
              <BottomSheetFlatList
                contentContainerStyle={StyleSheet.flatten([styles.listContent, { paddingHorizontal: gutter }])}
                data={searchResults}
                initialNumToRender={12}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item: CatalogItem) => item._id}
                ListEmptyComponent={isLoadingMoreResults || !effectiveData ? null : <ReedText tone="muted" variant="caption">No exercises match.</ReedText>}
                ListFooterComponent={isLoadingMoreResults ? <View style={styles.loadingSpacer} /> : null}
                ListHeaderComponent={<ReedText style={styles.resultsHeader} tone="muted" variant="caption">Results</ReedText>}
                maxToRenderPerBatch={8}
                onEndReached={hasMoreResults ? loadMoreResults : undefined}
                onEndReachedThreshold={0.6}
                renderItem={({ item, index }: { item: CatalogItem; index: number }) => (
                  <CatalogRow
                    isLast={index === searchResults.length - 1}
                    isSelected={selectedExerciseIdsSet.has(item._id)}
                    item={item}
                    onAddSingle={onAddSingle}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleSelected={toggleSelectedExercise}
                  />
                )}
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
                windowSize={7}
              />
            ) : (
              <BottomSheetScrollView
                contentContainerStyle={StyleSheet.flatten([styles.listContent, styles.browseContent, { paddingHorizontal: gutter }])}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
              >
                {((effectiveData?.favorites?.length ?? 0) > 0 || (effectiveData?.recents?.length ?? 0) > 0) ? (
                  <SegmentedControl<'favorites' | 'recents'>
                    compact
                    onChange={setExerciseListTab}
                    options={[
                      { label: 'Favorites', value: 'favorites' },
                      { label: 'Recents', value: 'recents' },
                    ]}
                    value={exerciseListTab}
                    variant="pill"
                  />
                ) : null}
                <CatalogSection
                  items={browseItems(exerciseListTab === 'favorites' ? effectiveData?.favorites : effectiveData?.recents)}
                  onAddSingle={onAddSingle}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleSelected={toggleSelectedExercise}
                  selectedExerciseIds={selectedExerciseIdsSet}
                />
                <CatalogSection
                  items={browseItems(effectiveData?.suggested)}
                  onAddSingle={onAddSingle}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleSelected={toggleSelectedExercise}
                  selectedExerciseIds={selectedExerciseIdsSet}
                  title="Exercises"
                />
              </BottomSheetScrollView>
            )}

            <View style={[styles.dock, { paddingBottom: insets.bottom + theme.spacing.sm, paddingHorizontal: gutter }]}>
              <View style={styles.filterSummaryRow}>
                <ReedText numberOfLines={1} style={styles.filterSummaryLine} tone="muted" variant="caption">{filterSummary}</ReedText>
                <ReedButton
                  disabled={activeFilterCount === 0}
                  label="Clear"
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
                  variant="quiet"
                />
              </View>

              <View style={[styles.searchShell, { backgroundColor: theme.colors.surfaceRaised }]}>
                <Ionicons color={String(theme.colors.inkMuted)} name="search" size={18} />
                <ReedSheetTextInput
                  accessibilityLabel="Search exercises"
                  onChangeText={setSearchText}
                  placeholder="Search exercises"
                  placeholderTextColor={String(theme.colors.inkMuted)}
                  selectionColor={String(theme.colors.accent)}
                  style={[styles.searchInput, bareInputStyle, { color: theme.colors.ink, fontFamily: theme.typography.body.fontFamily }]}
                  value={searchText}
                />
                <View style={[styles.searchDivider, { backgroundColor: theme.colors.lineStrong }]} />
                <Pressable
                  accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
                  accessibilityRole="button"
                  onPress={openFilterSheet}
                  style={({ pressed }) => [styles.searchFilterButton, getTapScaleStyle(pressed)]}
                >
                  <Ionicons color={String(theme.colors.inkSecondary)} name="options-outline" size={18} />
                  <ReedText tone="secondary" variant="caption">Filters</ReedText>
                  {activeFilterCount > 0 ? (
                    <View style={[styles.searchFilterBadge, { backgroundColor: theme.colors.accentSoft }]}>
                      <ReedText tone="accent" variant="micro">{activeFilterCount}</ReedText>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </ReedSheet>
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
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.catalogSection}>
      {title ? (
        <ReedText tone="muted" variant="caption">
          {title}
        </ReedText>
      ) : null}
      <View style={styles.catalogList}>
        {items.map((item, index) => (
          <CatalogRow
            isLast={index === items.length - 1}
            isSelected={selectedExerciseIds.has(item._id)}
            item={item}
            key={item._id}
            onAddSingle={onAddSingle}
            onToggleFavorite={onToggleFavorite}
            onToggleSelected={onToggleSelected}
          />
        ))}
      </View>
    </View>
  );
}

const CatalogRow = memo(function CatalogRow({
  isLast,
  isSelected,
  item,
  onAddSingle,
  onToggleFavorite,
  onToggleSelected,
}: {
  isLast: boolean;
  isSelected: boolean;
  item: CatalogItem;
  onAddSingle: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
  onToggleFavorite: (exerciseCatalogId: Id<'exerciseCatalog'>, nextIsFavorite: boolean) => void;
  onToggleSelected: (exerciseCatalogId: Id<'exerciseCatalog'>) => void;
}) {
  const { theme } = useReedTheme();
  return (
    <View
      style={[
        styles.catalogRow,
        {
          borderBottomColor: theme.colors.line,
          borderBottomWidth: isLast ? 0 : 1,
        },
      ]}
    >
      <Pressable accessibilityLabel={`Add ${item.name}`} accessibilityRole="button" onPress={() => onAddSingle(item._id)} style={({ pressed }) => [styles.catalogRowPressable, getTapScaleStyle(pressed)]}>
        <View style={styles.catalogRowCopy}>
          <ReedText numberOfLines={1} variant="bodyStrong">{item.name}</ReedText>
          <ReedText numberOfLines={1} tone="muted" variant="caption">
            {[item.exerciseClass, item.primaryTargetAreaLabels[0] ?? item.primaryFocusAreaLabels[0] ?? item.mainMuscleGroups[0], item.equipment[0]].filter(Boolean).join(' · ')}
          </ReedText>
        </View>
      </Pressable>
      <Pressable accessibilityLabel={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`} accessibilityRole="button" onPress={() => onToggleSelected(item._id)} style={({ pressed }) => [styles.catalogActionButton, getTapScaleStyle(pressed)]}>
        <Ionicons color={String(isSelected ? theme.colors.accentInk : theme.colors.inkSecondary)} name={isSelected ? 'checkmark-circle' : 'add-circle-outline'} size={22} />
      </Pressable>
      <Pressable accessibilityLabel={item.isFavorite ? `Unfavorite ${item.name}` : `Favorite ${item.name}`} accessibilityRole="button" onPress={() => onToggleFavorite(item._id, !item.isFavorite)} style={({ pressed }) => [styles.catalogActionButton, getTapScaleStyle(pressed)]}>
        <Ionicons color={String(item.isFavorite ? theme.colors.accentInk : theme.colors.inkMuted)} name={item.isFavorite ? 'star' : 'star-outline'} size={20} />
      </Pressable>
    </View>
  );
});

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

  return (
    <View style={styles.filterSectionBlock}>
      <View style={styles.filterSectionHeaderRow}>
        <View style={styles.filterSectionHeaderCopy}>
          <ReedText variant="bodyStrong">{title}</ReedText>
          <ReedText tone="muted" variant="caption">
            {subtitle}
          </ReedText>
        </View>
        <ReedButton disabled={selectedCount === 0} label="Clear" onPress={onClear} variant="quiet" />
      </View>

      <View style={[styles.filterSearchShell, { backgroundColor: theme.colors.surfaceRaised }]}>
        <Ionicons color={String(theme.colors.inkMuted)} name="search" size={16} />
        <ReedSheetTextInput
          onChangeText={onSearchChange}
          placeholder={`Find ${title.toLowerCase()}`}
          placeholderTextColor={String(theme.colors.inkMuted)}
          selectionColor={String(theme.colors.accent)}
          style={[
            styles.filterSearchInput,
            bareInputStyle,
            {
              color: theme.colors.ink,
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
                  { backgroundColor: isSelected ? theme.colors.accentSoft : theme.colors.surfaceRaised, ...getTapScaleStyle(pressed) },
                ]}
              >
                <ReedText numberOfLines={1} style={styles.filterOptionLabel} variant="body">
                  {option.label}
                </ReedText>
                <Ionicons
                  color={String(isSelected ? theme.colors.accentInk : theme.colors.inkMuted)}
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
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
        <ReedButton disabled={selectedCount === 0} label="Clear" onPress={onClear} variant="quiet" />
      </View>

      <View style={[styles.filterSearchShell, { backgroundColor: theme.colors.surfaceRaised }]}>
        <Ionicons color={String(theme.colors.inkMuted)} name="search" size={16} />
        <ReedSheetTextInput
          onChangeText={onSearchChange}
          placeholder="Find body area"
          placeholderTextColor={String(theme.colors.inkMuted)}
          selectionColor={String(theme.colors.accent)}
          style={[
            styles.filterSearchInput,
            bareInputStyle,
            {
              color: theme.colors.ink,
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
                <View style={[styles.filterOptionRow, { backgroundColor: isParentSelected ? theme.colors.accentSoft : theme.colors.surfaceRaised }]}>
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
                        color={String(theme.colors.inkMuted)}
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                      />
                    </Pressable>
                  ) : null}
                  <Ionicons
                    color={String(isParentSelected ? theme.colors.accentInk : theme.colors.inkMuted)}
                    name={isParentSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
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
                            { backgroundColor: isChildSelected ? theme.colors.accentSoft : theme.colors.surfaceRaised, ...getTapScaleStyle(pressed) },
                          ]}
                        >
                          <ReedText numberOfLines={1} style={styles.filterOptionLabel} variant="caption">
                            {child.label}
                          </ReedText>
                          <Ionicons
                            color={String(isChildSelected ? theme.colors.accentInk : theme.colors.inkMuted)}
                            name={isChildSelected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
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
