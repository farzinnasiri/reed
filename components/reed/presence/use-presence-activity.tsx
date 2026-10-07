import { useIsFocused } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";

/** Frozen tabs remain mounted; their ambient work must still stop. */
const Activity = createContext<boolean | null>(null);
export function PresenceActivityProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return <Activity.Provider value={active}>{children}</Activity.Provider>;
}
export function usePresenceActivity() {
  const ownerActive = useContext(Activity);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    if (Platform.OS !== "web" || typeof document === "undefined")
      return () => subscription.remove();
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      subscription.remove();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (ownerActive ?? focused) && foreground && visible;
}
