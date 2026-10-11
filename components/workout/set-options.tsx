import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { ReedText } from "@/components/ui/reed-text";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { Reveal } from "@/components/ui/reveal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePickerHaptics } from "@/design/haptic-feedback";
import { useReedTheme } from "@/design/provider";
import { reedRadii, reedSessionMetrics } from "@/design/system";
import type {
  CaptureCard,
  RangeOfMotion,
  SetOutcomeDetails,
} from "./workout-surface.types";

const angles = [15, 30, 45, 60, 75] as const;

export function setOptionsLabel(details: SetOutcomeDetails) {
  return (
    [
      details.inclineAngleDegrees === undefined
        ? null
        : `${details.inclineAngleDegrees}°`,
      details.rangeOfMotion && details.rangeOfMotion !== "full"
        ? "Partial"
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Technique"
  );
}

export function SetOptions({
  capabilities,
  details,
  onChange,
  disabled,
}: {
  capabilities: CaptureCard["modifierCapabilities"];
  details: SetOutcomeDetails;
  onChange: (details: SetOutcomeDetails) => void;
  disabled: boolean;
}) {
  const { theme } = useReedTheme();
  const { height } = useWindowDimensions();
  const compact = height < reedSessionMetrics.compactHeight;
  const rom = details.rangeOfMotion ?? "full";
  const partial = rom !== "full";
  return (
    <View style={{ gap: compact ? theme.spacing.xs : theme.spacing.lg, paddingTop: compact ? 0 : theme.spacing.sm }}>
      {capabilities.setup.includes("inclineAngle") ? (
        <AngleRail
          compact={compact}
          disabled={disabled}
          value={details.inclineAngleDegrees}
          onChange={(inclineAngleDegrees) =>
            onChange({ ...details, inclineAngleDegrees })
          }
        />
      ) : null}
      {capabilities.setOutcome.includes("rangeOfMotion") ? (
        <View style={{ gap: compact ? theme.spacing.xs : theme.spacing.sm }}>
          <ReedText variant="bodyStrong">Range of motion (ROM)</ReedText>
          <SegmentedControl
            haptic
            motion="quick"
            disabled={disabled}
            value={partial ? "partial" : "full"}
            onChange={(value) =>
              onChange({
                ...details,
                rangeOfMotion: value === "full" ? "full" : "bottom_partial",
              })
            }
            options={[
              {
                value: "full",
                label: "Full",
                icon: compact ? undefined : (
                  <Ionicons
                    name="resize-outline"
                    color={String(theme.colors.inkSecondary)}
                    size={18}
                  />
                ),
              },
              {
                value: "partial",
                label: "Partial",
                icon: compact ? undefined : (
                  <Ionicons
                    name="contract-outline"
                    color={String(theme.colors.inkSecondary)}
                    size={18}
                  />
                ),
              },
            ]}
            variant={compact ? "ghost" : "card"}
          />
          <View style={s.partialRail}>
            {partial ? (
              <Reveal>
                <SegmentedControl<RangeOfMotion>
                  haptic
                  motion="quick"
                  disabled={disabled}
                  value={rom}
                  onChange={(rangeOfMotion) =>
                    onChange({ ...details, rangeOfMotion })
                  }
                  options={[
                    { value: "bottom_partial", label: "Lower" },
                    { value: "mid_partial", label: "Middle" },
                    { value: "top_partial", label: "Upper" },
                  ]}
                  variant="ghost"
                />
              </Reveal>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function FailedRepToggle({
  details,
  onChange,
  disabled,
}: {
  details: SetOutcomeDetails;
  onChange: (details: SetOutcomeDetails) => void;
  disabled: boolean;
}) {
  const { theme } = useReedTheme();
  return (
    <HapticPressable
      accessibilityRole="switch"
      accessibilityLabel="Failed rep"
      accessibilityHint="An attempted rep you could not finish. Completed reps stay unchanged."
      accessibilityState={{ checked: Boolean(details.failedReps) }}
      hapticValue={Boolean(details.failedReps)}
      disabled={disabled}
      onPress={() =>
        onChange({
          ...details,
          failedReps: details.failedReps ? undefined : 1,
        })
      }
      style={{
        flex: 1,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing.xs,
        backgroundColor: details.failedReps ? theme.colors.accentSoft : theme.colors.surfaceRaised,
      }}
    >
      <ReedText
        variant="caption"
        tone={details.failedReps ? "accent" : "secondary"}
      >
        Failed rep
      </ReedText>
    </HapticPressable>
  );
}

function AngleRail({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  disabled: boolean;
  compact: boolean;
}) {
  const { theme } = useReedTheme();
  const rail = useRef<View>(null);
  const width = useRef(0);
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);
  const feedback = usePickerHaptics();
  const choose = (index: number) => {
    if (disabled) return;
    const next = angles[Math.max(0, Math.min(angles.length - 1, index))];
    if (next === current.current) return;
    current.current = next;
    feedback.preview();
    onChange(next);
  };
  const drag = (pageX: number) =>
    rail.current?.measureInWindow((left) => {
      if (Number.isFinite(pageX))
        choose(
          Math.round(
            Math.max(
              0,
              Math.min(
                1,
                (pageX - left - 24) / Math.max(1, width.current - 48),
              ),
            ) *
              (angles.length - 1),
          ),
        );
    });
  return (
    <View style={{ gap: compact ? 0 : theme.spacing.xs }}>
      <View style={s.heading}>
        <ReedText variant="bodyStrong">Bench angle</ReedText>
        <HapticPressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Clear bench angle"
          onPress={() => onChange(undefined)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <ReedText
            variant="caption"
            tone={value === undefined ? "muted" : "accent"}
          >
            {value === undefined ? "Unset" : `${value}° · Clear`}
          </ReedText>
        </HapticPressable>
      </View>
      <View
        ref={rail}
        accessibilityRole="adjustable"
        accessibilityLabel="Bench angle"
        accessibilityValue={{
          min: 15,
          max: 75,
          now: value,
          text: value === undefined ? "Unset" : `${value} degrees`,
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) =>
          choose(
            angles.findIndex((angle) => angle === value) +
              (event.nativeEvent.actionName === "increment" ? 1 : -1),
          )
        }
        onLayout={(event) => {
          width.current = event.nativeEvent.layout.width;
        }}
        onStartShouldSetResponder={() => !disabled}
        onResponderGrant={(event) => drag(event.nativeEvent.pageX)}
        onResponderMove={(event) => drag(event.nativeEvent.pageX)}
        onResponderRelease={feedback.settle}
        onResponderTerminate={feedback.cancel}
        style={s.rail}
        {...(Platform.OS === "web"
          ? {
              tabIndex: disabled ? -1 : 0,
              onKeyDown: (event: {
                key: string;
                preventDefault: () => void;
              }) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                choose(
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? angles.length - 1
                      : angles.findIndex((angle) => angle === value) +
                        (event.key === "ArrowRight" ? 1 : -1),
                );
              },
            }
          : {})}
      >
        <View
          style={[
            s.track,
            { backgroundColor: theme.colors.lineStrong, pointerEvents: "none" },
          ]}
        />
        <View style={[s.stops, { pointerEvents: "none" }]}>
          {angles.map((angle) => (
            <View
              key={angle}
              style={[
                s.dot,
                {
                  backgroundColor:
                    value === angle
                      ? theme.colors.accent
                      : theme.colors.inkMuted,
                  transform: [{ scale: value === angle ? 1 : 0.5 }],
                },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={s.heading}>
        {angles.map((angle) => (
          <HapticPressable
            key={angle}
            accessibilityLabel={`Bench angle ${angle} degrees`}
            accessibilityRole="radio"
            aria-checked={value === angle}
            accessibilityState={{ checked: value === angle }}
            disabled={disabled}
            onPress={() => onChange(angle)}
            style={s.angle}
          >
            <ReedText
              variant="caption"
              tone={value === angle ? "accent" : "muted"}
            >
              {angle}°
            </ReedText>
          </HapticPressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  partialRail: { height: 52 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rail: { height: 44, justifyContent: "center" },
  track: {
    position: "absolute",
    left: 24,
    right: 24,
    height: 3,
    borderRadius: reedRadii.pill,
  },
  stops: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  dot: { width: 20, height: 20, borderRadius: reedRadii.pill },
  angle: {
    minHeight: 44,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
  },
});
