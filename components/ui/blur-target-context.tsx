import { BlurTargetView } from 'expo-blur';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, View, type LayoutChangeEvent, type ViewProps } from 'react-native';

type GlassBlurTargetContextValue = {
  isReady: boolean;
  markReady: () => void;
  targetRef: React.RefObject<View | null>;
};

const GlassBlurTargetContext = createContext<GlassBlurTargetContextValue | null>(null);

export function GlassBlurTargetProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<View | null>(null);
  const [isReady, setIsReady] = useState(Platform.OS !== 'android');
  const markReady = useCallback(() => {
    setIsReady(true);
  }, []);
  const value = useMemo(
    () => ({
      isReady,
      markReady,
      targetRef,
    }),
    [isReady, markReady],
  );

  return (
    <GlassBlurTargetContext.Provider value={value}>
      {children}
    </GlassBlurTargetContext.Provider>
  );
}

export function GlassBlurTarget({ children, onLayout, ...props }: ViewProps) {
  const target = useGlassBlurTarget();
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      target?.markReady();
      onLayout?.(event);
    },
    [onLayout, target],
  );

  if (Platform.OS !== 'android' || !target) {
    return (
      <View onLayout={onLayout} {...props}>
        {children}
      </View>
    );
  }

  return (
    <BlurTargetView ref={target.targetRef} onLayout={handleLayout} {...props}>
      {children}
    </BlurTargetView>
  );
}

export function useGlassBlurTarget() {
  return useContext(GlassBlurTargetContext);
}
