import { createContext, useContext } from 'react';
import { usePulse } from '@/components/home/pulse/use-pulse';
import type { ReedRelatedSession, ReedWidget } from '../reed.types';
import { PlanCard } from './plan-card';
import { QuickLogCard } from './quick-log-card';
import { SessionChangeCard } from './session-change-card';
import { SessionSummaryCard } from './session-summary-card';
import { WeighInCard } from './weigh-in-card';
import { ExpandableWidget, type WidgetDisclosure } from './expandable-widget';

/** What a widget can ask the home screen to do. */
export type ReedWidgetActions = {
  /** `null` opens the full sheet; a key opens it with that preset selected. */
  openQuickLog: (presetKey: string | null) => void;
  /** Opens the session that is in progress. */
  openWorkout: () => void;
  openSession: (sessionId: string) => void;
  onSessionChangeApplied?: (sessionId: string, exerciseId: string) => void;
};

const ReedWidgetActionsContext = createContext<ReedWidgetActions | null>(null);

export const ReedWidgetActionsProvider = ReedWidgetActionsContext.Provider;

export function useReedWidgetActions() {
  const actions = useContext(ReedWidgetActionsContext);
  if (!actions) throw new Error('Reed widgets must render inside ReedWidgetActionsProvider.');
  return actions;
}

/**
 * The widget catalog on the client (plan 2.3): maps a stored `kind` to its component. A widget
 * holds references only, so every card reads live data. Kinds this build does not know render
 * nothing, which keeps newer messages harmless on older clients.
 */
export function ReedWidgetView({ related = null, widget, disclosure }: { related?: ReedRelatedSession | null; widget: NonNullable<ReedWidget>; disclosure?: WidgetDisclosure }) {
  const actions = useReedWidgetActions();

  switch (widget.kind) {
    case 'session_summary':
      return wrap(<SessionSummaryCard onOpen={actions.openSession} related={related} sessionId={widget.sessionId} />, 'Workout summary', 'barbell-outline');
    case 'weigh_in':
      return <WeighInWidget disclosure={disclosure} />;
    case 'quick_log':
      return <QuickLogCard onOpenQuickLog={actions.openQuickLog} presetKeys={widget.presetKeys} disclosure={disclosure} />;
    case 'plan':
      return wrap(<PlanCard onOpenSession={actions.openSession} onOpenWorkout={actions.openWorkout} plannedSessionId={widget.plannedSessionId} />, 'Your plan', 'list-outline');
    case 'session_change':
      return wrap(<SessionChangeCard actionId={widget.actionId} onApplied={actions.onSessionChangeApplied} />, 'Workout change', 'swap-horizontal-outline');
    default:
      return null;
  }
  function wrap(content: React.ReactNode, label: string, icon: 'barbell-outline' | 'list-outline' | 'swap-horizontal-outline') {
    return disclosure ? <ExpandableWidget disclosure={disclosure} summary={{ label, icon }}>{content}</ExpandableWidget> : content;
  }
}

// In chat the weigh-in has no today-card payload, so it reads the last weigh-in from the Pulse.
function WeighInWidget({ disclosure }: { disclosure?: WidgetDisclosure }) {
  const pulse = usePulse();

  if (!pulse) return null;

  return <WeighInCard lastKg={pulse.bodyweight?.latestKg ?? null} lastLoggedAt={pulse.bodyweight?.loggedAt ?? null} disclosure={disclosure} />;
}
