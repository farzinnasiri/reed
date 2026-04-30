// ---------------------------------------------------------------------------
// RankedGoalList — drag-to-reorder goal ranking.
// PanResponders are created once per goal value and stored in a ref map
// to avoid the "gesture dropped on re-render" bug.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

const ITEM_HEIGHT = 54;
const ITEM_GAP = 8;
const ITEM_STRIDE = ITEM_HEIGHT + ITEM_GAP;

type GoalOption<T extends string> = {
  label: string;
  subtitle?: string;
  value: T;
};

type RankedGoalListProps<T extends string> = {
  availableGoals: GoalOption<T>[];
  onChangeRanked: (values: T[]) => void;
  ranked: T[];
};

export function RankedGoalList<T extends string>({
  availableGoals,
  onChangeRanked,
  ranked,
}: RankedGoalListProps<T>) {
  const { theme } = useReedTheme();

  // ---------------------------------------------------------------------------
  // Drag state — all mutable state in refs to avoid re-render during gesture.
  // Only draggingIndex / hoverIndex are in React state (they drive visual shifts).
  // ---------------------------------------------------------------------------
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Stable Animated values — never recreated
  const dragY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Mutable refs so gesture callbacks capture them without re-registration
  const rankedRef = useRef<T[]>(ranked);
  rankedRef.current = ranked;

  const onChangeRef = useRef(onChangeRanked);
  onChangeRef.current = onChangeRanked;

  const draggingIndexRef = useRef<number | null>(null);

  function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
  }

  // ---------------------------------------------------------------------------
  // One stable PanResponder per goal value, kept in a ref map.
  // We recreate ONLY when the set of goal values changes.
  // ---------------------------------------------------------------------------
  const panResponders = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      panResponders.current = {};
    };
  }, []);

  // Build or reuse a PanResponder for a given goal value.
  // The closure reads live state via mutable refs so we never need to recreate.
  function getOrCreatePanResponder(goalValue: T) {
    if (!panResponders.current[goalValue]) {
      panResponders.current[goalValue] = PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,

        onPanResponderGrant: () => {
          const itemIndex = rankedRef.current.indexOf(goalValue);
          draggingIndexRef.current = itemIndex;
          setDraggingIndex(itemIndex);
          setHoverIndex(itemIndex);
          dragY.setValue(0);
          Animated.spring(scale, {
            toValue: 1.04,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }).start();
        },

        onPanResponderMove: (_, gesture) => {
          dragY.setValue(gesture.dy);
          const fromIndex = draggingIndexRef.current ?? 0;
          const rawIndex = fromIndex + gesture.dy / ITEM_STRIDE;
          const next = clamp(Math.round(rawIndex), 0, rankedRef.current.length - 1);
          setHoverIndex(next);
        },

        onPanResponderRelease: (_, gesture) => {
          Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start();

          const fromIndex = draggingIndexRef.current ?? 0;
          const rawIndex = fromIndex + gesture.dy / ITEM_STRIDE;
          const targetIndex = clamp(Math.round(rawIndex), 0, rankedRef.current.length - 1);

          if (targetIndex !== fromIndex) {
            const reordered = [...rankedRef.current];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(targetIndex, 0, moved);
            onChangeRef.current(reordered);
          }

          dragY.setValue(0);
          draggingIndexRef.current = null;
          setDraggingIndex(null);
          setHoverIndex(null);
        },

        onPanResponderTerminate: () => {
          Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start();
          dragY.setValue(0);
          draggingIndexRef.current = null;
          setDraggingIndex(null);
          setHoverIndex(null);
        },
      });
    }
    return panResponders.current[goalValue];
  }

  function addGoal(value: T) {
    if (!ranked.includes(value)) {
      onChangeRanked([...ranked, value]);
    }
  }

  function removeGoal(value: T) {
    // Clean up the cached PanResponder for this goal when removed
    delete panResponders.current[value];
    onChangeRanked(ranked.filter(v => v !== value));
  }

  const unranked = availableGoals.filter(g => !ranked.includes(g.value));

  return (
    <View>
      {/* Ranked list */}
      {ranked.length > 0 ? (
        <View style={styles.rankedList}>
          {ranked.map((value, index) => {
            const goal = availableGoals.find(g => g.value === value);
            if (!goal) return null;

            const isDragging = draggingIndex === index;

            // Visual shift for non-dragging items to indicate drop target
            let shift = 0;
            if (draggingIndex !== null && hoverIndex !== null && !isDragging) {
              if (draggingIndex < hoverIndex) {
                if (index > draggingIndex && index <= hoverIndex) shift = -ITEM_STRIDE;
              } else if (draggingIndex > hoverIndex) {
                if (index >= hoverIndex && index < draggingIndex) shift = ITEM_STRIDE;
              }
            }

            const pr = getOrCreatePanResponder(value);

            return (
              <Animated.View
                key={value}
                style={[
                  styles.rankedItem,
                  {
                    backgroundColor: theme.colors.controlFill,
                    borderColor: isDragging ? theme.colors.accentPrimary : theme.colors.controlBorder,
                    borderWidth: 1,
                    zIndex: isDragging ? 10 : 1,
                    transform: isDragging
                      ? [{ translateY: dragY }, { scale }]
                      : [{ translateY: shift }],
                    // Use design-system floating shadow while dragging; no shadow at rest.
                    ...(isDragging ? theme.shadows.floating : {}),
                  },
                ]}
              >
                {/* Rank badge */}
                <View
                  style={[
                    styles.rankBadge,
                    { 
                      borderColor: theme.colors.borderStrong,
                      backgroundColor: theme.colors.canvasSecondary,
                    },
                  ]}
                >
                  <ReedText
                    style={{ color: theme.colors.textPrimary }}
                    variant="label"
                  >
                    {String(index + 1)}
                  </ReedText>
                </View>

                <ReedText
                  style={{ color: theme.colors.textPrimary, flex: 1 }}
                  variant="bodyStrong"
                >
                  {goal.label}
                </ReedText>

                {/* Drag handle — 3 horizontal lines. Pan gesture attached ONLY here. */}
                <View style={styles.dragHandleWrapper} {...pr.panHandlers}>
                  <View style={styles.dragHandle}>
                    {[0, 1, 2].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.dragLine,
                          { backgroundColor: theme.colors.textMuted, opacity: 0.6 },
                        ]}
                      />
                    ))}
                  </View>
                </View>

                {/* Remove tap target */}
                <Pressable
                  accessibilityLabel={`Remove ${goal.label}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => removeGoal(value)}
                  style={({ pressed }) => [
                    styles.removeButton,
                    getTapScaleStyle(pressed),
                  ]}
                >
                  <ReedText
                    style={{ color: theme.colors.textMuted }}
                    variant="bodyStrong"
                  >
                    ×
                  </ReedText>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      ) : (
        <View
          style={[
            styles.emptyRanked,
            { borderColor: theme.colors.borderSoft },
          ]}
        >
          <ReedText tone="muted" variant="caption">
            Tap a goal below to add it here.
          </ReedText>
        </View>
      )}

      {/* Available (unranked) goals */}
      {unranked.length > 0 ? (
        <View style={styles.unrankedList}>
          {unranked.map(goal => (
            <Pressable
              key={goal.value}
              onPress={() => addGoal(goal.value)}
              style={({ pressed }) => [
                styles.unrankedItem,
                {
                  borderColor: theme.colors.controlBorder,
                  backgroundColor: theme.colors.controlFill,
                },
                getTapScaleStyle(pressed),
              ]}
            >
              <ReedText variant="bodyStrong">{goal.label}</ReedText>
              {goal.subtitle ? (
                <ReedText tone="muted" variant="caption">
                  {goal.subtitle}
                </ReedText>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rankedList: {
    gap: ITEM_GAP,
    marginBottom: 12,
  },
  rankedItem: {
    alignItems: 'center',
    borderRadius: reedRadii.sm,
    flexDirection: 'row',
    gap: 12,
    height: ITEM_HEIGHT,
    paddingHorizontal: 14,
  },
  rankBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  dragHandleWrapper: {
    // Larger hit area than the visible lines
    alignItems: 'center',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 36,
  },
  dragHandle: {
    gap: 3,
    alignItems: 'center',
  },
  dragLine: {
    borderRadius: 1,
    height: 2,
    width: 14,
  },
  removeButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  emptyRanked: {
    alignItems: 'center',
    borderRadius: reedRadii.sm,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    marginBottom: 12,
  },
  unrankedList: {
    gap: ITEM_GAP,
  },
  unrankedItem: {
    borderRadius: reedRadii.sm,
    borderWidth: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: ITEM_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
