import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type QuickLogPreset = {
  _id: Id<'quickLogPresets'>;
  group: 'strength' | 'cardio' | 'recovery';
  inputKind: 'reps' | 'duration' | 'duration_or_distance';
  key: string;
  label: string;
  sortOrder: number;
};

type QuickLogSheetProps = {
  onClose: () => void;
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

type CachedPresetPayload = {
  cachedAt: number;
  presets: QuickLogPreset[];
};

export function QuickLogSheet({ onClose, visible }: QuickLogSheetProps) {
  const { theme } = useReedTheme();
  const [isMounted, setIsMounted] = useState(visible);
  const [cachedPresets, setCachedPresets] = useState<QuickLogPreset[] | null>(null);
  const { height } = useWindowDimensions();
  const [shouldFetchPresets, setShouldFetchPresets] = useState(false);
  const fetchedPresets = useQuery(api.quickLogs.listPresets, visible && shouldFetchPresets ? {} : 'skip');
  const ensurePresets = useMutation(api.quickLogs.ensurePresets);
  const logActivity = useMutation(api.quickLogs.log);
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const overlayOpacity = sheetProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const openTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });
  const [selectedPreset, setSelectedPreset] = useState<QuickLogPreset | null>(null);
  const [reps, setReps] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      sheetProgress.setValue(0);
      createTiming(sheetProgress, 1, reedMotion.durations.mode + 80).start();
      return;
    }

    if (!isMounted) {
      return;
    }

    createTiming(sheetProgress, 0, reedMotion.durations.mode).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [isMounted, sheetProgress, visible]);

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
        const parsed = JSON.parse(value) as CachedPresetPayload;
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
    const nextPresets = fetchedPresets as QuickLogPreset[];
    setCachedPresets(nextPresets);
    setShouldFetchPresets(false);
    void AsyncStorage.setItem(
      PRESET_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), presets: nextPresets } satisfies CachedPresetPayload),
    );
  }, [fetchedPresets]);

  useEffect(() => {
    if (!visible) {
      setSelectedPreset(null);
      setReps('');
      setDurationMinutes('');
      setDistanceKm('');
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [visible]);

  function requestClose() {
    if (!isMounted) {
      onClose();
      return;
    }

    createTiming(sheetProgress, 0, reedMotion.durations.mode).start(() => {
      setIsMounted(false);
      onClose();
    });
  }

  const presets = cachedPresets ?? fetchedPresets ?? undefined;

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

  const canSave = selectedPreset ? isInputValid(selectedPreset, { distanceKm, durationMinutes, reps }) : false;

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
      onClose();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isMounted) {
    return null;
  }

  return (
    <Modal animationType="none" onRequestClose={requestClose} transparent visible={isMounted}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.overlay}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.overlayScrim,
              opacity: overlayOpacity,
              pointerEvents: 'none',
            },
          ]}
        />
        <Pressable accessibilityLabel="Close quick log" onPress={requestClose} style={styles.backdrop} />
        <Animated.View
          style={[
            styles.sheetFrame,
            {
              transform: [{ translateY: openTranslateY }],
            },
          ]}
        >
        <GlassSurface contentStyle={styles.sheetContent} style={styles.sheet}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: theme.colors.textMuted }]} />
          </View>

          <View style={styles.sheetHeader}>
            <View style={styles.titleBlock}>
              <ReedText variant="section">Quick log</ReedText>
              <ReedText tone="muted" variant="caption">
                Capture one activity. No workout session created.
              </ReedText>
            </View>
            <Pressable
              accessibilityLabel="Close quick log"
              onPress={requestClose}
              style={({ pressed }) => [styles.closeButton, getTapScaleStyle(pressed)]}
            >
              <Ionicons color={String(theme.colors.textMuted)} name="close" size={18} />
            </Pressable>
          </View>

          {selectedPreset ? (
            <View style={styles.formStack}>
              <Pressable onPress={() => setSelectedPreset(null)} style={({ pressed }) => getTapScaleStyle(pressed)}>
                <ReedText tone="muted" variant="caption">← Choose another</ReedText>
              </Pressable>

              <View style={styles.selectedTitleRow}>
                <ReedText variant="title">{selectedPreset.label}</ReedText>
              </View>

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

              {errorMessage ? <ReedText tone="danger">{errorMessage}</ReedText> : null}
              <ReedButton disabled={!canSave || isSaving} label={isSaving ? 'Saving...' : 'Save'} onPress={() => void handleSave()} />
            </View>
          ) : presets === undefined ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={String(theme.colors.accentPrimary)} />
              <ReedText tone="muted">Loading quick actions...</ReedText>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.presetScroll}>
              <View style={styles.groupStack}>
                {groupOrder.map(group => {
                  const items = groupedPresets.get(group) ?? [];
                  if (items.length === 0) {
                    return null;
                  }
                  return (
                    <View key={group} style={styles.groupBlock}>
                      <ReedText tone="muted" variant="label">{groupLabels[group].toUpperCase()}</ReedText>
                      <View style={styles.presetGrid}>
                        {items.map(preset => (
                          <Pressable
                            accessibilityLabel={`Quick log ${preset.label}`}
                            key={preset.key}
                            onPress={() => setSelectedPreset(preset)}
                            style={({ pressed }) => [
                              styles.presetButton,
                              {
                                backgroundColor: theme.colors.inputFill,
                                borderColor: theme.colors.inputBorder,
                              },
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
            </ScrollView>
          )}
        </GlassSurface>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
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
                {
                  backgroundColor: isSelected ? theme.colors.controlActiveFill : theme.colors.controlFill,
                  borderColor: theme.colors.controlBorder,
                },
                getTapScaleStyle(pressed),
              ]}
            >
              <ReedText tone={isSelected ? 'default' : 'muted'} variant="bodyStrong">
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetFrame: {
    maxHeight: '72%',
    minHeight: 320,
    zIndex: 1001,
    elevation: 1001,
  },
  sheet: {
    flex: 1,
  },
  sheetContent: {
    gap: 18,
    paddingBottom: 28,
  },
  handleArea: {
    alignItems: 'center',
    paddingBottom: 4,
    paddingTop: 2,
  },
  handle: {
    borderRadius: reedRadii.pill,
    height: 4,
    opacity: 0.45,
    width: 42,
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
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 96,
  },
  presetScroll: {
    maxHeight: 480,
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
    gap: 10,
  },
  presetButton: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formStack: {
    gap: 14,
  },
  selectedTitleRow: {
    paddingBottom: 2,
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
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    minHeight: 40,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
