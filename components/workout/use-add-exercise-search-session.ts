import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import type { AddExerciseSheetData } from './workout-surface.types';

export type AddExerciseFilterSectionKey = 'muscles' | 'equipment';

export function useAddExerciseSearchSession(isOpen: boolean) {
  const [searchText, setSearchText] = useState('');
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([]);
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
          muscleGroups: selectedMuscleGroups.length > 0 ? selectedMuscleGroups : undefined,
          query: searchText.trim() || undefined,
        }
      : 'skip',
  );
  // Keep the last successful payload while a follow-up query resolves so the
  // sheet doesn't flicker to empty between keystrokes/filter changes.
  const [stableData, setStableData] = useState<AddExerciseSheetData | undefined>(data);
  const effectiveData = data ?? stableData;
  const selectedExerciseIdsSet = useMemo(() => new Set(selectedExerciseIds), [selectedExerciseIds]);
  const hasSearchContext =
    searchText.trim().length > 0 || selectedMuscleGroups.length > 0 || selectedEquipment.length > 0;
  const activeFilterCount = selectedMuscleGroups.length + selectedEquipment.length;
  const selectedCount = selectedExerciseIds.length;
  const filterSectionOptions = useMemo(
    () => [
      {
        label: selectedMuscleGroups.length > 0 ? `Muscles (${selectedMuscleGroups.length})` : 'Muscles',
        value: 'muscles' as const,
      },
      {
        label: selectedEquipment.length > 0 ? `Equipment (${selectedEquipment.length})` : 'Equipment',
        value: 'equipment' as const,
      },
    ],
    [selectedEquipment.length, selectedMuscleGroups.length],
  );

  useEffect(() => {
    if (data) {
      setStableData(current => (current === data ? current : data));
    }
  }, [data]);

  function toggleSelectedExercise(exerciseCatalogId: Id<'exerciseCatalog'>) {
    setSelectedExerciseIds(current =>
      current.includes(exerciseCatalogId)
        ? current.filter(id => id !== exerciseCatalogId)
        : [...current, exerciseCatalogId],
    );
  }

  function resetSearchSession() {
    setSearchText('');
    setSelectedMuscleGroups([]);
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
    filterSectionOptions,
    hasSearchContext,
    muscleSearchText,
    searchText,
    selectedCount,
    selectedEquipment,
    selectedExerciseIds,
    selectedExerciseIdsSet,
    selectedMuscleGroups,
    resetSearchSession,
    setActiveFilterSection,
    setEquipmentSearchText,
    setMuscleSearchText,
    setSearchText,
    setSelectedEquipment,
    setSelectedExerciseIds,
    setSelectedMuscleGroups,
    toggleSelectedExercise,
  };
}
