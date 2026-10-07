import { DurationStopwatch } from '@/components/workout/duration-stopwatch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { analytics } from '@/lib/analytics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

import { readQuickLogCache, type QuickLogPreset } from './quick-log-cache';

type QuickLogSheetProps = {
  onClose: () => void;
  /** Opens with this preset selected (a widget's tile) instead of the preset list. */
  presetKey?: string | null;
  visible: boolean;
};

const groupLabels: Record<QuickLogPreset['group'], string> = {
  cardio: 'Cardio',
  recovery: 'Recovery',
  strength: 'Strength',
};

const groupOrder: QuickLogPreset['group'][] = ['strength', 'cardio', 'recovery'];
const PRESET_CACHE_KEY = 'quick_log_presets_v1';
const PRESET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// One height for the list and the form, so choosing an activity never resizes the sheet.
const SHEET_FRACTION = 0.74;

const quickValuesByPreset: Record<string, { distance?: number[]; duration?: number[]; reps?: number[] }> = {
  air_squats: { reps: [10, 15, 20, 30, 50] },
  cycle: { distance: [5, 10, 20, 30], duration: [10, 20, 30, 45, 60] },
  dips: { reps: [5, 8, 10, 12, 15, 20] },
  mobility: { duration: [5, 10, 15, 20, 30] },
  plank: { duration: [30 / 60, 45 / 60, 1, 2, 3] },
  pull_ups: { reps: [1, 3, 5, 8, 10, 12, 15] },
  push_ups: { reps: [5, 10, 15, 20, 25, 30] },
  run: { distance: [1, 3, 5, 10], duration: [10, 20, 30, 45, 60] },
  stretching: { duration: [5, 10, 15, 20, 30] },
  walk: { distance: [1, 2, 3, 5], duration: [10, 20, 30, 45, 60] },
};

export function QuickLogSheet({ onClose, presetKey = null, visible }: QuickLogSheetProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const [cachedPresets, setCachedPresets] = useState<QuickLogPreset[] | null>(null);
  const [shouldFetchPresets, setShouldFetchPresets] = useState(false);
  const fetchedPresets = useQuery(api.quickLogs.listPresets, visible && shouldFetchPresets ? {} : 'skip');
  const ensurePresets = useMutation(api.quickLogs.ensurePresets);
  const logActivity = useMutation(api.quickLogs.log);
  const [selectedPreset, setSelectedPreset] = useState<QuickLogPreset | null>(null);
  const [reps, setReps] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [isTimingActivity, setIsTimingActivity] = useState(false);
  const [distanceKm, setDistanceKm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let isMounted = true;
    AsyncStorage.getItem(PRESET_CACHE_KEY)
      .then(value => {
        if (!isMounted) {
          return;
        }
        if (!value) {
          setShouldFetchPresets(true);
          void ensurePresets({}).catch(error => setErrorMessage(getErrorMessage(error)));
          return;
        }
        const parsed = readQuickLogCache(value);
        const isFresh = Date.now() - parsed.cachedAt < PRESET_CACHE_TTL_MS;
        if (isFresh && parsed.presets.length > 0) {
          setCachedPresets(parsed.presets);
          setShouldFetchPresets(false);
          return;
        }
        setShouldFetchPresets(true);
        void ensurePresets({}).catch(error => setErrorMessage(getErrorMessage(error)));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setShouldFetchPresets(true);
        void ensurePresets({}).catch(error => setErrorMessage(getErrorMessage(error)));
      });

    return () => {
      isMounted = false;
    };
  }, [ensurePresets, visible]);

  useEffect(() => {
    if (!fetchedPresets || fetchedPresets.length === 0) {
      return;
    }
    const nextPresets = fetchedPresets;
    void AsyncStorage.setItem(
      PRESET_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), presets: nextPresets }),
    );
  }, [fetchedPresets]);

  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) {
      setSelectedPreset(null);
      setReps('');
      setDurationMinutes('');
      setDistanceKm('');
      setErrorMessage(null);
      setIsSaving(false);
      setIsTimingActivity(false);
    }
  }

  const presets = fetchedPresets ?? cachedPresets ?? undefined;

  // A widget tile opens the sheet on its preset, once per opening, so "Choose another" still works.
  const [appliedPresetKey, setAppliedPresetKey] = useState<string | null>(null);
  {
    if (!visible && appliedPresetKey !== null) setAppliedPresetKey(null);
    const preset = visible && presetKey && appliedPresetKey !== presetKey
      ? presets?.find(candidate => candidate.key === presetKey) : null;
    if (preset) {
      setAppliedPresetKey(presetKey);
      setSelectedPreset(preset);
    }
  }

  const groupedPresets = useMemo(() => {
    const byGroup = new Map<QuickLogPreset['group'], QuickLogPreset[]>();
    for (const preset of presets ?? []) {
      const list = byGroup.get(preset.group) ?? [];
      list.push(preset as QuickLogPreset);
      byGroup.set(preset.group, list);
    }
    for (const list of byGroup.values()) {
      list.sort((left, right) => left.sortOrder - right.sortOrder);
    }
    return byGroup;
  }, [presets]);

  const [previousPresetKey, setPreviousPresetKey] = useState(selectedPreset?.key);
  if (previousPresetKey !== selectedPreset?.key) { setPreviousPresetKey(selectedPreset?.key); setIsTimingActivity(false); }
  const canSave = selectedPreset && !isTimingActivity ? isInputValid(selectedPreset, { distanceKm, durationMinutes, reps }) : false;

  async function handleSave() {
    if (!selectedPreset || !canSave) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await logActivity({
        distanceKm: parseOptionalNumber(distanceKm),
        durationSeconds: parseOptionalDurationSeconds(durationMinutes),
        presetId: selectedPreset._id,
        reps: parseOptionalInteger(reps),
      });
      analytics.quickLogSubmitted({
        exerciseGroup: selectedPreset.group,
        inputKind: selectedPreset.inputKind,
      });
      haptics.success();
      onClose();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ReedSheet heightFraction={SHEET_FRACTION} onDismiss={onClose} open={visible}>
      <View style={styles.sheet}>
        <View style={[styles.sheetHeader, { paddingHorizontal: theme.spacing.gutter }]}>
          <View style={styles.titleBlock}>
            <ReedText variant="title">Quick log</ReedText>
            <ReedText tone="muted" variant="caption">
              Capture one activity. No workout session created.
            </ReedText>
          </View>
          <ReedIconButton accessibilityLabel="Close quick log" onPress={onClose} variant="ghost">
            <Ionicons color={String(theme.colors.inkSecondary)} name="close" size={22} />
          </ReedIconButton>
        </View>

        {selectedPreset ? (
          <>
            <BottomSheetScrollView
              contentContainerStyle={[styles.formScrollContent, { paddingHorizontal: theme.spacing.gutter }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              <Pressable
                accessibilityLabel="Choose another activity"
                accessibilityRole="button"
                onPress={() => setSelectedPreset(null)}
                style={({ pressed }) => [styles.backRow, getTapScaleStyle(pressed)]}
              >
                <Ionicons color={String(theme.colors.inkMuted)} name="chevron-back" size={16} />
                <ReedText tone="muted" variant="caption">Choose another</ReedText>
              </Pressable>

              <ReedText variant="headline">{selectedPreset.label}</ReedText>

              {selectedPreset.inputKind === 'reps' ? (
                <View style={styles.formStack}>
                  <ReedInput
                    keyboardType="number-pad"
                    label="Reps"
                    onChangeText={setReps}
                    placeholder="e.g. 10"
                    value={reps}
                  />
                  <QuickValueRow
                    label="Quick reps"
                    onSelect={value => setReps(String(value))}
                    selectedValue={parseOptionalInteger(reps)}
                    values={quickValuesByPreset[selectedPreset.key]?.reps ?? []}
                  />
                </View>
              ) : null}

              {selectedPreset.inputKind !== 'reps' ? <DurationStopwatch key={selectedPreset.key} onDuration={seconds => setDurationMinutes(String(Number((seconds / 60).toFixed(3))))} onRunningChange={setIsTimingActivity} /> : null}
              {selectedPreset.inputKind === 'duration' ? (
                <View style={styles.formStack}>
                  <ReedInput
                    keyboardType="decimal-pad"
                    label="Minutes"
                    onChangeText={setDurationMinutes}
                    placeholder="e.g. 20"
                    value={durationMinutes}
                  />
                  <QuickValueRow
                    label="Quick minutes"
                    onSelect={value => setDurationMinutes(formatQuickNumber(value))}
                    selectedValue={parseOptionalNumber(durationMinutes)}
                    values={quickValuesByPreset[selectedPreset.key]?.duration ?? []}
                  />
                </View>
              ) : null}

              {selectedPreset.inputKind === 'duration_or_distance' ? (
                <View style={styles.formStack}>
                  <ReedInput
                    keyboardType="decimal-pad"
                    label="Minutes"
                    onChangeText={setDurationMinutes}
                    placeholder="Optional"
                    value={durationMinutes}
                  />
                  <QuickValueRow
                    label="Quick minutes"
                    onSelect={value => setDurationMinutes(formatQuickNumber(value))}
                    selectedValue={parseOptionalNumber(durationMinutes)}
                    values={quickValuesByPreset[selectedPreset.key]?.duration ?? []}
                  />
                  <ReedInput
                    keyboardType="decimal-pad"
                    label="Distance (km)"
                    onChangeText={setDistanceKm}
                    placeholder="Optional"
                    value={distanceKm}
                  />
                  <QuickValueRow
                    label="Quick km"
                    onSelect={value => setDistanceKm(formatQuickNumber(value))}
                    selectedValue={parseOptionalNumber(distanceKm)}
                    values={quickValuesByPreset[selectedPreset.key]?.distance ?? []}
                  />
                  <ReedText tone="muted" variant="caption">Add duration, distance, or both.</ReedText>
                </View>
              ) : null}
            </BottomSheetScrollView>

            <View style={[styles.formFooter, { paddingBottom: insets.bottom + theme.spacing.md, paddingHorizontal: theme.spacing.gutter }]}>
              {errorMessage ? <ReedText accessibilityLiveRegion="polite" tone="danger" variant="caption">{errorMessage}</ReedText> : null}
              <ReedButton disabled={!canSave || isSaving} label={isSaving ? 'Saving...' : 'Save'} onPress={() => void handleSave()} />
            </View>
          </>
        ) : presets === undefined ? (
          <View style={[styles.loadingRow, { paddingHorizontal: theme.spacing.gutter }]}>
            <ActivityIndicator color={String(theme.colors.accent)} />
            <ReedText tone="muted">Loading quick actions...</ReedText>
          </View>
        ) : (
          <BottomSheetScrollView
            contentContainerStyle={[styles.presetScrollContent, { paddingBottom: insets.bottom + theme.spacing.md, paddingHorizontal: theme.spacing.gutter }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            <View style={styles.groupStack}>
              {groupOrder.map(group => {
                const items = groupedPresets.get(group) ?? [];
                if (items.length === 0) {
                  return null;
                }
                return (
                  <View key={group} style={styles.groupBlock}>
                    <ReedText tone="muted" variant="caption">{groupLabels[group]}</ReedText>
                    <View style={styles.presetGrid}>
                      {items.map(preset => (
                        <Pressable
                          accessibilityLabel={`Quick log ${preset.label}`}
                          accessibilityRole="button"
                          key={preset.key}
                          onPress={() => setSelectedPreset(preset)}
                          style={({ pressed }) => [
                            styles.presetButton,
                            { backgroundColor: theme.colors.surfaceRaised },
                            getTapScaleStyle(pressed),
                          ]}
                        >
                          <ReedText variant="bodyStrong">{preset.label}</ReedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </BottomSheetScrollView>
        )}
      </View>
    </ReedSheet>
  );
}

function QuickValueRow({
  label,
  onSelect,
  selectedValue,
  values,
}: {
  label: string;
  onSelect: (value: number) => void;
  selectedValue: number | null;
  values: number[];
}) {
  const { theme } = useReedTheme();

  if (values.length === 0) {
    return null;
  }

  return (
    <View style={styles.quickValueBlock}>
      <ReedText tone="muted" variant="caption">{label}</ReedText>
      <View style={styles.quickValueRow}>
        {values.map(value => {
          const isSelected = selectedValue === value;
          return (
            <Pressable
              key={value}
              onPress={() => onSelect(value)}
              style={({ pressed }) => [
                styles.quickValueChip,
                { backgroundColor: isSelected ? theme.colors.accentSoft : theme.colors.surfaceRaised },
                getTapScaleStyle(pressed),
              ]}
            >
              <ReedText tone={isSelected ? 'accent' : 'secondary'} variant="bodyStrong">
                {formatQuickNumber(value)}
              </ReedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function isInputValid(
  preset: QuickLogPreset,
  values: { distanceKm: string; durationMinutes: string; reps: string },
) {
  if (preset.inputKind === 'reps') {
    return (parseOptionalInteger(values.reps) ?? 0) > 0;
  }
  if (preset.inputKind === 'duration') {
    return (parseOptionalDurationSeconds(values.durationMinutes) ?? 0) > 0;
  }
  return (parseOptionalDurationSeconds(values.durationMinutes) ?? 0) > 0 || (parseOptionalNumber(values.distanceKm) ?? 0) > 0;
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDurationSeconds(value: string) {
  const minutes = parseOptionalNumber(value);
  return minutes === null ? null : Math.round(minutes * 60);
}

function formatQuickNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'Could not save quick log.');
  }
  return 'Could not save quick log.';
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    gap: 12,
    minHeight: 0,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: 4,
    paddingTop: 4,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 96,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  presetScrollContent: {
    flexGrow: 1,
    paddingTop: 4,
  },
  groupStack: {
    gap: 20,
  },
  groupBlock: {
    gap: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  backRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
  },
  formStack: {
    gap: 14,
  },
  formFooter: {
    gap: 12,
    paddingTop: 8,
  },
  formScrollContent: {
    gap: 14,
    paddingBottom: 18,
  },
  quickValueBlock: {
    gap: 8,
  },
  quickValueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickValueChip: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 48,
    paddingHorizontal: 14,
  },
});
