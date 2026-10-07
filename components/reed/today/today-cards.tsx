import { QuickLogCard } from '../widgets/quick-log-card';
import { useReedWidgetActions } from '../widgets/registry';
import { WeighInCard } from '../widgets/weigh-in-card';
import type { TodayCard } from './use-today-cards';
import type { WidgetDisclosure } from '../widgets/expandable-widget';

/** One of Reed's proactive cards (`home.getTodayCards`), with its reason as the origin line. */
export function TodayCardView({ card, onDismiss, disclosure }: { card: TodayCard; onDismiss: () => void; disclosure?: WidgetDisclosure }) {
  const { openQuickLog } = useReedWidgetActions();

  switch (card.kind) {
    case 'weigh_in':
      return <WeighInCard lastKg={card.lastKg} lastLoggedAt={card.lastLoggedAt} onDismiss={onDismiss} origin={card.reason} disclosure={disclosure} />;
    case 'quick_log':
      return <QuickLogCard onDismiss={onDismiss} onOpenQuickLog={openQuickLog} origin={card.reason} presetKeys={card.presetKeys} disclosure={disclosure} />;
    default:
      return null;
  }
}
