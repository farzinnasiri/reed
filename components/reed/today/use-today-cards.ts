import { z } from 'zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { useFiveMinuteNow } from '@/components/home/use-five-minute-now';
import { getLocalDayBounds } from '@/lib/local-day';

const DISMISSED_CARDS_KEY = 'reed:home:dismissed-today-cards:v1';

export type TodayCard = FunctionReturnType<typeof api.home.getTodayCards>[number];

const dismissedCardsSchema = z.object({ dayStartAt: z.number().finite(), kinds: z.array(z.string()) });
type DismissedCards = z.infer<typeof dismissedCardsSchema>;

/**
 * The cards Reed brings to today mode (`home.getTodayCards`, derived from facts, nothing stored).
 * Dismissing one hides its kind for the rest of the device's local day; the marker lives on this
 * device and ignores itself once the day changes. Cards leave on their own when their condition
 * stops being true (you weighed in, you logged something).
 */
export function useTodayCards() {
  const now = useFiveMinuteNow();
  const cards = useQuery(api.home.getTodayCards, { now });
  // undefined until storage has answered, so a dismissed card never flashes on first render.
  const [dismissed, setDismissed] = useState<DismissedCards | null | undefined>(undefined);
  const dayStartAt = getLocalDayBounds(now).startAt;

  useEffect(() => {
    let isActive = true;
    void AsyncStorage.getItem(DISMISSED_CARDS_KEY)
      .then(value => {
        if (isActive) setDismissed(value ? dismissedCardsSchema.parse(JSON.parse(value)) : null);
      })
      .catch(() => {
        if (isActive) setDismissed(null);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const dismiss = useCallback((kind: string) => {
    const kinds = dismissed?.dayStartAt === dayStartAt ? dismissed.kinds : [];
    const next = { dayStartAt, kinds: [...kinds, kind] };
    setDismissed(next);
    void AsyncStorage.setItem(DISMISSED_CARDS_KEY, JSON.stringify(next)).catch(() => {});
  }, [dayStartAt, dismissed]);

  const hiddenKinds = dismissed?.dayStartAt === dayStartAt ? dismissed.kinds : [];

  return {
    cards: dismissed === undefined ? [] : (cards ?? []).filter(card => !hiddenKinds.includes(card.kind)),
    dismiss,
  };
}
