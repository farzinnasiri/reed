import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePaginatedQuery, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import type { AddExerciseSheetData } from './workout-surface.types';

export type AddExerciseFilterSectionKey = 'muscles' | 'equipment';

const SEARCH_QUERY_DEBOUNCE_MS = 180;

export function useAddExerciseSearchSession(isOpen: boolean) {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [selectedTargetAreas, setSelectedTargetAreas] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Id<'exerciseCatalog'>[]>([]);
  const [muscleSearchText, setMuscleSearchText] = useState('');
  const [equipmentSearchText, setEquipmentSearchText] = useState('');
  const [activeFilterSection, setActiveFilterSection] = useState<AddExerciseFilterSectionKey>('muscles');
  const bootstrap = useQuery(api.exerciseCatalog.getPickerBootstrap, isOpen ? {} : 'skip');
  const hasCommittedSearchContext =
    debouncedSearchText.length > 0 || selectedFocusAreas.length > 0 || selectedTargetAreas.length > 0 || selectedEquipment.length > 0;
  const search = usePaginatedQuery(
    api.exerciseCatalog.searchForPicker,
    isOpen && hasCommittedSearchContext
      ? {
          equipment: selectedEquipment.length > 0 ? selectedEquipment : undefined,
          focusAreas: selectedFocusAreas.length > 0 ? selectedFocusAreas : undefined,
          targetAreas: selectedTargetAreas.length > 0 ? selectedTargetAreas : undefined,
          query: debouncedSearchText || undefined,
        }
      : 'skip',
    { initialNumItems: 40 },
  );
  const [stableResults, setStableResults] = useState<AddExerciseSheetData['results']>([]);
  const [hasCompletedSearch, setHasCompletedSearch] = useState(false);
  const { loadMore } = search;
  const lastSettledResultCountRef = useRef(0);
  const searchSignature = `${debouncedSearchText}|${selectedFocusAreas.join(',')}|${selectedTargetAreas.join(',')}|${selectedEquipment.join(',')}`;
  const [previousSearchSignature, setPreviousSearchSignature] = useState(searchSignature);
  if (previousSearchSignature !== searchSignature) {
    setPreviousSearchSignature(searchSignature);
    setHasCompletedSearch(false);
  }
  useEffect(() => { lastSettledResultCountRef.current = 0; }, [searchSignature]);
  useEffect(() => {
    if (search.status !== 'CanLoadMore') return;
    if (search.results.length === lastSettledResultCountRef.current) {
      loadMore(40);
      return;
    }
    lastSettledResultCountRef.current = search.results.length;
  }, [loadMore, search.results.length, search.status]);
  if (search.status !== 'LoadingFirstPage' && stableResults !== search.results) {
    setStableResults(search.results);
    setHasCompletedSearch(true);
  }
  const displayedResults = search.status === 'LoadingFirstPage' ? stableResults : search.results;
  const effectiveData = useMemo<AddExerciseSheetData | undefined>(
    () => bootstrap ? { ...bootstrap, results: displayedResults } : undefined,
    [bootstrap, displayedResults],
  );
  const selectedExerciseIdsSet = useMemo(() => new Set(selectedExerciseIds), [selectedExerciseIds]);
  const activeFilterCount = selectedFocusAreas.length + selectedTargetAreas.length + selectedEquipment.length;
  const selectedCount = selectedExerciseIds.length;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, SEARCH_QUERY_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isOpen, searchText]);

  function toggleSelectedExercise(exerciseCatalogId: Id<'exerciseCatalog'>) {
    setSelectedExerciseIds(current =>
      current.includes(exerciseCatalogId)
        ? current.filter(id => id !== exerciseCatalogId)
        : [...current, exerciseCatalogId],
    );
  }

  const resetSearchSession = useCallback(() => {
    setSearchText('');
    setDebouncedSearchText('');
    setSelectedFocusAreas([]);
    setSelectedTargetAreas([]);
    setSelectedEquipment([]);
    setSelectedExerciseIds([]);
    setMuscleSearchText('');
    setEquipmentSearchText('');
    setActiveFilterSection('muscles');
  }, []);

  return {
    activeFilterCount,
    activeFilterSection,
    effectiveData,
    equipmentSearchText,
    hasSearchContext: hasCommittedSearchContext && (hasCompletedSearch || stableResults.length > 0),
    hasMoreResults: search.status === 'CanLoadMore',
    isLoadingMoreResults: search.status === 'LoadingMore',
    loadMoreResults: () => {
      if (search.status === 'CanLoadMore') {
        loadMore(40);
      }
    },
    muscleSearchText,
    searchText,
    selectedCount,
    selectedEquipment,
    selectedExerciseIds,
    selectedExerciseIdsSet,
    selectedFocusAreas,
    selectedTargetAreas,
    resetSearchSession,
    setActiveFilterSection,
    setEquipmentSearchText,
    setMuscleSearchText,
    setSearchText,
    setSelectedEquipment,
    setSelectedExerciseIds,
    setSelectedFocusAreas,
    setSelectedTargetAreas,
    toggleSelectedExercise,
  };
}
