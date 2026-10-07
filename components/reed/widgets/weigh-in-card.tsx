import { useFiveMinuteNow } from '@/components/home/use-five-minute-now';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { getLocalDayBounds } from '@/lib/local-day';
import { WidgetCard } from './widget-card';
import { ExpandableWidget, type WidgetDisclosure } from './expandable-widget';
import { DEFAULT_KG } from './weight';
import { WeightStepper } from './weight-stepper';

type WeighInCardProps = {
  lastKg: number | null;
  lastLoggedAt: number | null;
  onDismiss?: () => void;
  origin?: string;
  disclosure?: WidgetDisclosure;
};

function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(timestamp));
}

/**
 * Today's weigh-in: steppers from the last weight, Save writes today's bodyweight through the
 * existing mutation. Once there is a weigh-in today (live, from `lastLoggedAt`) the steppers give
 * way to the logged value, so an older chat widget never offers a second weigh-in.
 */
export function WeighInCard({ lastKg, lastLoggedAt, onDismiss, origin, disclosure }: WeighInCardProps) {
  const { theme } = useReedTheme();
  const upsertTodayBodyWeight = useMutation(api.profiles.upsertTodayBodyWeight);
  const [valueKg, setValueKg] = useState(lastKg ?? DEFAULT_KG);
  const [isSaving, setIsSaving] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const now = useFiveMinuteNow();
  const isLoggedToday = lastKg !== null && lastLoggedAt !== null && lastLoggedAt >= getLocalDayBounds(now).startAt;

  async function save() {
    setIsSaving(true);
    setHasFailed(false);
    try {
      const now = Date.now();
      const bounds = getLocalDayBounds(now);
      await upsertTodayBodyWeight({ dayEndAt: bounds.endAt, dayStartAt: bounds.startAt, observedAt: now, valueKg });
      haptics.success();
      disclosure?.onChange(false);
    } catch {
      setHasFailed(true);
    } finally {
      setIsSaving(false);
    }
  }

  const content = isLoggedToday ? (
      <WidgetCard origin={disclosure ? undefined : origin} title={disclosure ? undefined : `Weight for today · ${formatShortDate(now)}`}>
        <View style={styles.row}>
          <Ionicons color={String(theme.colors.successInk)} name="checkmark-circle-outline" size={22} />
          <ReedText style={styles.loggedValue} variant="stat">
            {lastKg.toFixed(1)}
            <ReedText tone="muted" variant="caption"> kg</ReedText>
          </ReedText>
          <ReedText tone="muted" variant="caption">Logged today</ReedText>
        </View>
      </WidgetCard>
    ) : (
    <WidgetCard
      onDismiss={disclosure ? undefined : onDismiss}
      origin={disclosure ? undefined : origin}
      title={disclosure ? undefined : `Weight for today · ${formatShortDate(now)}`}
    >
      {lastKg !== null && lastLoggedAt !== null ? <ReedText tone="muted" variant="caption" style={{ marginBottom: theme.spacing.sm }}>Previous: {lastKg.toFixed(1)} kg · {formatShortDate(lastLoggedAt)}</ReedText> : null}
      <WeightStepper
        onChange={setValueKg}
        trailing={<ReedButton disabled={isSaving} label={isSaving ? 'Saving' : 'Save'} onPress={() => void save()} variant="soft" />}
        valueKg={valueKg}
      />
      {hasFailed ? <ReedText style={styles.error} tone="danger" variant="caption">Could not save. Try again.</ReedText> : null}
    </WidgetCard>
  );
  const summaryDetail = lastKg !== null && lastLoggedAt !== null
    ? `${lastKg.toFixed(1)} kg · ${isLoggedToday ? 'Today' : formatShortDate(lastLoggedAt)}`
    : 'Add your first weigh-in';
  return disclosure ? <ExpandableWidget disclosure={disclosure} summary={{ label: isLoggedToday ? 'Weight logged' : 'Log weight', icon: 'scale-outline', detail: summaryDetail, expandedDetail: `Today · ${formatShortDate(now)}`, complete: isLoggedToday }}>{content}</ExpandableWidget> : content;
}

const styles = StyleSheet.create({
  error: {
    marginTop: 8,
  },
  loggedValue: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
});
