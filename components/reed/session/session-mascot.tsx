import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Portal, PortalHost } from "@gorhom/portal";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { reedMotion, reedSprings } from "@/design/motion";
import { useStageRecedeProgress } from "@/design/stage-recede";
import { useReedTheme } from "@/design/provider";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import { ReedMascot, type MascotController } from "../mascot";
import type { MascotAnchor } from "../presence-mascot";
import {
  PresenceActivityProvider,
  usePresenceActivity,
} from "../presence/use-presence-activity";
import { reedSessionMetrics as metrics } from "@/design/system";

const HOST = "reed-workout-mascot";
type Placement = {
  open: boolean;
  header: MascotAnchor | null;
  controller: MascotController | null;
};
const Context = createContext<{
  placement: Placement;
  setOpen: (open: boolean) => void;
  anchor: (anchor: MascotAnchor | null) => void;
  drive: (controller: MascotController) => void;
  sheetPosition: SharedValue<number>;
} | null>(null);

/** Dedicated host stays above gorhom's scrim, without intercepting sheet gestures. */
export function SessionMascotHost() {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { pointerEvents: "none", zIndex: 100 },
      ]}
    >
      <PortalHost name={HOST} />
    </View>
  );
}
export function SessionMascotProvider({ children }: { children: ReactNode }) {
  const active = usePresenceActivity();
  // The portal drawing the mascot does not inherit this subtree's context, so the recede is passed in.
  const recede = useStageRecedeProgress();
  const { height } = useWindowDimensions();
  const sheetPosition = useSharedValue(height * (1 - metrics.sheetFraction));
  const [placement, setPlacement] = useState<Placement>({
    open: false,
    header: null,
    controller: null,
  });
  const [actions] = useState(() => ({
    setOpen: (open: boolean) =>
      setPlacement((p) => (p.open === open ? p : { ...p, open })),
    anchor: (header: MascotAnchor | null) =>
      setPlacement((p) =>
        p.header?.cx === header?.cx && p.header?.cy === header?.cy
          ? p
          : { ...p, header },
      ),
    drive: (controller: MascotController) =>
      setPlacement((p) => ({ ...p, controller })),
  }));
  return (
    <Context.Provider value={{ placement, ...actions, sheetPosition }}>
      {children}
      {active ? (
        <Portal name="workout-reed" hostName={HOST}>
          <PresenceActivityProvider active={active}>
            <GlidingMascot
              placement={placement}
              recede={recede}
              sheetPosition={sheetPosition}
            />
          </PresenceActivityProvider>
        </Portal>
      ) : null}
    </Context.Provider>
  );
}
export function useSessionMascotBridge() {
  const value = useContext(Context);
  if (!value) throw new Error("Session mascot requires its workout provider.");
  return { drive: value.drive, sheetPosition: value.sheetPosition };
}
export function useSessionMascot(controller: MascotController, sheet: boolean) {
  const context = useContext(Context);
  if (!context)
    throw new Error("Session mascot requires its workout provider.");
  const { drive, placement } = context;
  useEffect(() => {
    if (placement.open === sheet) drive(controller);
  }, [controller, drive, placement.open, sheet]);
  return context;
}
export function SessionMascotSlot({
  controller,
  open,
}: {
  controller: MascotController;
  open: boolean;
}) {
  const { setOpen, anchor } = useSessionMascot(controller, false);
  const slot = useRef<View>(null);
  useEffect(() => () => anchor(null), [anchor]);
  useEffect(() => {
    setOpen(open);
  }, [open, setOpen]);
  useEffect(() => {
    if (open) return;
    const frame = requestAnimationFrame(() =>
      slot.current?.measureInWindow((x, y, width, height) =>
        anchor({ cx: x + width / 2, cy: y + height / 2, size: metrics.header }),
      ),
    );
    return () => cancelAnimationFrame(frame);
  }, [anchor, open]);
  return (
    <View
      ref={slot}
      collapsable={false}
      onLayout={() =>
        slot.current?.measureInWindow((x, y, width, height) => {
          if (!open)
            anchor({
              cx: x + width / 2,
              cy: y + height / 2,
              size: metrics.header,
            });
        })
      }
      style={{ width: metrics.hit, height: metrics.hit }}
    />
  );
}
function GlidingMascot({
  placement,
  recede,
  sheetPosition,
}: {
  placement: Placement;
  recede: SharedValue<number> | null;
  sheetPosition: SharedValue<number>;
}) {
  const { theme } = useReedTheme();
  const { height, width } = useWindowDimensions();
  const reduced = useReedReducedMotion();
  const progress = useSharedValue(0);
  const settledY = useSharedValue(height * (1 - metrics.sheetFraction));
  const destinationY = useDerivedValue(() => {
    if (placement.open) settledY.set(sheetPosition.get());
    return settledY.get() + metrics.handle + metrics.sheetMascot / 2;
  });
  useEffect(() => {
    progress.set(
      reduced
        ? withTiming(placement.open ? 1 : 0, {
            duration: reedMotion.durations.standard,
            reduceMotion: ReduceMotion.Never,
          })
        : withSpring(placement.open ? 1 : 0, reedSprings.morph),
    );
  }, [placement.open, progress, reduced]);
  const header = placement.header;
  // Fixed 88% sheet: handle 24px, then a 56px header slot, matching ReedSheet.
  const destinationX = theme.spacing.chromeGutter + metrics.sheetMascot / 2;
  const style = useAnimatedStyle(() => {
    const raw = progress.get(),
      t = reduced ? (raw > 0.5 ? 1 : 0) : raw;
    // While any other sheet is open the stage behind recedes (scales and fades about its centre).
    // The header mascot sits on that stage, so it recedes with it; in the conversation sheet it does not.
    const dim = (recede?.get() ?? 0) * (1 - t);
    const recedeScale = reduced ? 1 : 1 - dim * (1 - reedMotion.scale.stageRecede);
    const fromX = width / 2 + ((header?.cx ?? 0) - width / 2) * recedeScale;
    const fromY = height / 2 + ((header?.cy ?? 0) - height / 2) * recedeScale;
    return {
      opacity: (!header ? 0 : reduced ? Math.abs(raw * 2 - 1) : 1) * (1 - dim * (1 - reedMotion.opacity.stageRecede)),
      transform: [
        { translateX: fromX + (destinationX - fromX) * t - metrics.sheetMascot / 2 },
        { translateY: fromY + (destinationY.get() - fromY) * t - metrics.sheetMascot / 2 },
        {
          scale:
            ((metrics.header + (metrics.sheetMascot - metrics.header) * t) / metrics.sheetMascot) * recedeScale,
        },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          width: metrics.sheetMascot,
          height: metrics.sheetMascot,
          pointerEvents: "none",
        },
        style,
      ]}
    >
      {placement.controller ? (
        <ReedMascot
          size={metrics.sheetMascot}
          mascot={placement.controller}
          halo={false}
        />
      ) : null}
    </Animated.View>
  );
}
