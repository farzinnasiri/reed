import { BodyViewer } from "@/components/body-3d/body-viewer";
import {
  resolveMuscles,
  type BodyVariant,
} from "@/components/body-3d/contract";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReedIconButton } from "@/components/ui/reed-icon-button";
import { ReedSheet } from "@/components/ui/reed-sheet";
import { ReedText } from "@/components/ui/reed-text";
import { useReedTheme } from "@/design/provider";
import { reedExerciseImageMetrics, reedSessionMetrics } from "@/design/system";

type Props = {
  imageUrl: string | null;
  variant?: "row" | "timeline" | "heading" | "preview";
};

/** The visible exercise name supplies the label; missing artwork never interrupts training. */
export function ExerciseImage({ imageUrl, variant = "row" }: Props) {
  return (
    <ImageContent
      key={imageUrl ?? "missing"}
      imageUrl={imageUrl}
      variant={variant}
    />
  );
}

function ImageContent({ imageUrl, variant = "row" }: Props) {
  const { theme } = useReedTheme();
  const [failed, setFailed] = useState(false);
  const preview = variant === "preview";
  const hasImage = Boolean(imageUrl && !failed);
  const diameter = preview ? 0 : reedExerciseImageMetrics[variant].width;
  const imageSize = diameter * (variant === "heading"
    ? reedExerciseImageMetrics.headingContainRatio
    : reedExerciseImageMetrics.containRatio);
  return (
    <View
      accessibilityElementsHidden={!preview}
      importantForAccessibility={preview ? "auto" : "no-hide-descendants"}
      style={[
        styles.frame,
        preview ? styles.preview : reedExerciseImageMetrics[variant],
        {
          backgroundColor: hasImage && !preview
            ? reedExerciseImageMetrics.canvas
            : "transparent",
          borderRadius: preview ? theme.radii.xs : theme.radii.pill,
        },
      ]}
    >
      {imageUrl && !failed ? (
        <Image
          accessible={false}
          onError={() => setFailed(true)}
          resizeMethod="resize"
          resizeMode="contain"
          source={{ uri: imageUrl }}
          style={preview ? StyleSheet.absoluteFill : { width: imageSize, height: imageSize }}
        />
      ) : (
        <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
          <Ionicons
            name="barbell-outline"
            size={preview ? 44 : 22}
            color={String(theme.colors.inkMuted)}
          />
          {preview ? (
            <ReedText tone="muted" variant="caption">
              Illustration unavailable
            </ReedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function ExerciseImageViewer({
  imageUrl,
  name,
  onClose,
  open,
  muscles,
}: {
  imageUrl: string | null;
  name: string;
  onClose: () => void;
  open: boolean;
  muscles?: { primary: string[]; secondary: string[] };
}) {
  const [tab, setTab] = useState<"movement" | "muscles">("movement");
  const profile = useQuery(
    api.profiles.viewerTrainingProfile,
    open && tab === "muscles" ? {} : "skip",
  );
  const variant: BodyVariant =
    profile?.trainingProfile?.onboarding?.sex === "female" ? "female" : "male";
  const [view, setView] = useState<"front" | "back">("front");
  const [viewRequest, setViewRequest] = useState(0);
  const hasMuscleMap = Boolean(
    muscles &&
    (resolveMuscles(muscles.primary).size ||
      resolveMuscles(muscles.secondary).size),
  );
  const { theme } = useReedTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <ReedSheet
      open={open}
      onDismiss={onClose}
      onBack={onClose}
      heightFraction={reedExerciseImageMetrics.previewFraction}
    >
      <View
        style={{
          height:
            (height - insets.top) * reedExerciseImageMetrics.previewFraction -
            reedSessionMetrics.handle,
          paddingHorizontal: theme.spacing.gutter,
          paddingBottom: insets.bottom + theme.spacing.md,
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
          }}
        >
          <ReedText variant="headline" style={{ flex: 1 }}>
            {name}
          </ReedText>
          <ReedIconButton
            accessibilityLabel="Close exercise illustration"
            onPress={onClose}
            variant="ghost"
          >
            <Ionicons name="close" size={22} color={String(theme.colors.ink)} />
          </ReedIconButton>
        </View>
        {hasMuscleMap ? (
          <SegmentedControl
            haptic
            value={tab}
            onChange={setTab}
            options={[
              { value: "movement", label: "Movement" },
              { value: "muscles", label: "Muscles" },
            ]}
            variant="ghost"
          />
        ) : null}
        {tab === "muscles" && hasMuscleMap && muscles ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: theme.spacing.sm }}
            showsVerticalScrollIndicator={false}
          >
            {open ? (
              <BodyViewer
                variant={variant}
                highlights={{
                  pain: {},
                  primary: [...resolveMuscles(muscles.primary)],
                  secondary: [...resolveMuscles(muscles.secondary)],
                }}
                height={Math.min(360, height * 0.36)}
                view={view}
                viewRequest={viewRequest}
              />
            ) : null}
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              <SegmentedControl<"front" | "back">
                compact
                haptic
                style={{ flex: 1 }}
                value={view}
                onChange={(next) => {
                  setView(next);
                  setViewRequest((value) => value + 1);
                }}
                options={[
                  { value: "front", label: "Front" },
                  { value: "back", label: "Back" },
                ]}
                variant="ghost"
              />
            </View>
            <ReedText
              variant="caption"
              style={{ color: theme.colors.bodyMuscle }}
            >
              Primary · {muscles.primary.join(" · ")}
            </ReedText>
            {muscles.secondary.length ? (
              <ReedText
                variant="caption"
                style={{ color: theme.colors.dataWarm }}
              >
                Secondary · {muscles.secondary.join(" · ")}
              </ReedText>
            ) : null}
          </ScrollView>
        ) : (
          <ExerciseImage imageUrl={imageUrl} variant="preview" />
        )}
      </View>
    </ReedSheet>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  preview: { flex: 1, width: "100%", minHeight: 0 },
});
