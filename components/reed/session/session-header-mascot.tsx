import { Pressable } from "react-native";
import { reedSessionMetrics } from "@/design/system";
import type { MascotController } from "../mascot";
import { SessionMascotSlot } from "./session-mascot";
export function SessionHeaderMascot({
  mascot,
  hidden,
  onTalk,
}: {
  mascot: MascotController;
  hidden: boolean;
  onTalk: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="Reed, watching. Talk to Reed."
      accessibilityRole="button"
      onPress={onTalk}
      style={{
        width: reedSessionMetrics.hit,
        height: reedSessionMetrics.hit,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SessionMascotSlot controller={mascot} open={hidden} />
    </Pressable>
  );
}
