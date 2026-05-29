import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
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
  const data = useQuery(
    api.exerciseCatalog.searchForAddSheet,
    isOpen
      ? {
          equipment: selectedEquipment.length > 0 ? selectedEquipment : undefined,
          focusAreas: selectedFocusAreas.length > 0 ? selectedFocusAreas : undefined,
          targetAreas: selectedTargetAreas.length > 0 ? selectedTargetAreas : undefined,
          query: debouncedSearchText || undefined,
        }
      : 'skip',
  );
  // Keep the last successful payload while a follow-up query resolves so the
  // sheet doesn't flicker to empty between keystrokes/filter changes.
  const [stableData, setStableData] = useState<AddExerciseSheetData | undefined>(data);
  const effectiveData = data ?? stableData;
  const selectedExerciseIdsSet = useMemo(() => new Set(selectedExerciseIds), [selectedExerciseIds]);
  const hasSearchContext =
    searchText.trim().length > 0 || selectedFocusAreas.length > 0 || selectedTargetAreas.length > 0 || selectedEquipment.length > 0;
  const activeFilterCount = selectedFocusAreas.length + selectedTargetAreas.length + selectedEquipment.length;
  const selectedCount = selectedExerciseIds.length;
  useEffect(() => {
    if (data) {
      setStableData(current => (current === data ? current : data));
    }
  }, [data]);

  useEffect(() => {
    if (!isOpen) {
      setDebouncedSearchText('');
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

  function resetSearchSession() {
    setSearchText('');
    setDebouncedSearchText('');
    setSelectedFocusAreas([]);
    setSelectedTargetAreas([]);
    setSelectedEquipment([]);
    setSelectedExerciseIds([]);
    setMuscleSearchText('');
    setEquipmentSearchText('');
    setActiveFilterSection('muscles');
  }

  return {
    activeFilterCount,
    activeFilterSection,
    effectiveData,
    equipmentSearchText,
    hasSearchContext,
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
