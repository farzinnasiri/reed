import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedWidgetMetrics } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { WidgetCardEmbeddedContext } from './widget-card';

export type WidgetDisclosure = {
  expanded: boolean;
  onChange: (expanded: boolean) => void;
};
type WidgetSummary = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  detail?: string;
  expandedDetail?: string;
  complete?: boolean;
};

/** Shared disclosure anatomy: one surface that grows from a summary into its controls. Children remain
 * mounted when collapsed, preserving edits and subscriptions. Only the expanded panel is
 * exposed to touch and accessibility. A caller may put direct actions in the summary row. */
export function ExpandableWidget({ disclosure, summary, children, actions }: {
  disclosure: WidgetDisclosure;
  summary: WidgetSummary;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const id = useId();
  const { expanded, onChange } = disclosure;
  const panelRef = useRef<View>(null);
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => {
    // aria-hidden alone does not prevent keyboard focus in clipped web descendants.
    if (Platform.OS === 'web' && panelRef.current) {
      (panelRef.current as unknown as HTMLElement).inert = !expanded;
    }
  }, [expanded]);
  // Built-in transitions own the interrupted state. Only the measured clipping height
  // changes layout; descendants keep their natural size and web uses browser transitions.
  const transition = { transitionDuration: reduced ? 0 : reedMotion.widgets.revealMs, transitionTimingFunction: reedMotion.widgets.easing };
  const panelStyle = { ...transition, transitionProperty: ['height', 'opacity'] as ('height' | 'opacity')[], height: expanded ? contentHeight : 0, opacity: expanded ? 1 : 0 };
  const contentStyle = { ...transition, transitionProperty: 'transform' as const, transform: [{ translateY: reduced || expanded ? 0 : reedMotion.widgets.contentY }] };
  const collapsedDetailStyle = { ...transition, transitionProperty: 'opacity' as const, opacity: summary.expandedDetail && expanded ? 0 : 1 };
  const expandedDetailStyle = { ...transition, transitionProperty: 'opacity' as const, opacity: expanded ? 1 : 0 };
  const chevronStyle = { ...transition, transitionProperty: 'transform' as const, transform: [{ rotate: `${expanded ? reedMotion.widgets.chevronDegrees : 0}deg` as `${number}deg` }] };
  return <View style={{ width: '100%' }}>
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' }}>
        {actions}
        <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${summary.label} widget`} accessibilityState={{ expanded }} aria-expanded={expanded} aria-controls={id}
          onPress={() => { haptics.selection(); onChange(!expanded); }}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: reedWidgetMetrics.summaryHeight, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, flex: 1 }, getTapScaleStyle(pressed)]}>
          <Ionicons name={summary.complete ? 'checkmark-circle-outline' : summary.icon} size={reedWidgetMetrics.summaryIcon} color={String(summary.complete ? theme.colors.successInk : theme.colors.accentInk)} />
          <View style={{ gap: theme.spacing.xxs, flex: 1 }}>
            <ReedText variant="bodyStrong">{summary.label}</ReedText>
            {summary.detail ? <View>
              <Animated.View aria-hidden={!!summary.expandedDetail && expanded} style={collapsedDetailStyle}><ReedText variant="caption" tone="secondary">{summary.detail}</ReedText></Animated.View>
              {summary.expandedDetail ? <Animated.View aria-hidden={!expanded} style={[{ position: 'absolute', left: 0, right: 0, top: 0 }, expandedDetailStyle]}><ReedText variant="caption" tone="secondary">{summary.expandedDetail}</ReedText></Animated.View> : null}
            </View> : null}
          </View>
          <Animated.View style={chevronStyle}><Ionicons name="chevron-forward" size={reedWidgetMetrics.summaryChevron} color={String(theme.colors.inkSecondary)} /></Animated.View>
        </Pressable>
      </View>
      <Animated.View nativeID={id} ref={panelRef} aria-hidden={!expanded} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'} style={[{ overflow: 'hidden', pointerEvents: expanded ? 'auto' : 'none' }, panelStyle]}>
        <Animated.View onLayout={event => setContentHeight(event.nativeEvent.layout.height)} style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, contentStyle]}>
          <WidgetCardEmbeddedContext.Provider value>{children}</WidgetCardEmbeddedContext.Provider>
        </Animated.View>
      </Animated.View>
    </View>
  </View>;
}
