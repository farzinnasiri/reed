import { Pressable, View } from "react-native";
import { reedSessionMetrics } from "@/design/system";
import type { MascotController } from "../mascot";
import { SessionMascotSlot } from "./session-mascot";

/**
 * Reed's place on a session screen: the slot the one session mascot glides to. With `onTalk` it is a
 * button (talk to Reed); without, it is only a place to be. `hidden` while the conversation sheet
 * has the mascot.
 */
export function SessionDockMascot({
  mascot,
  hidden,
  label = "Reed. Talk to Reed.",
  onTalk,
  size = reedSessionMetrics.dock,
}: {
  mascot: MascotController;
  hidden: boolean;
  label?: string;
  onTalk?: () => void;
  size?: number;
}) {
  const box = { width: size, height: size, alignItems: "center", justifyContent: "center" } as const;
  const slot = <SessionMascotSlot controller={mascot} open={hidden} size={size} />;
  if (!onTalk) return <View style={box}>{slot}</View>;
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onTalk} style={box}>
      {slot}
    </Pressable>
  );
}
