import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { LevelTile, gridCell, gridStyle } from '@/components/onboarding/controls';
import { BODY_SHAPES, DAY_LOAD_OPTIONS, RHYTHMS, SEX_OPTIONS, WEEKDAYS } from '@/components/onboarding/content';
import { MOVE_VALUES } from '@/components/onboarding/motivations';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedProfileMetrics } from '@/design/system';
import { PAIN_LABELS, recoveryDescription, regionLabel } from '@/domains/profile/onboarding';
import { formatBodyMetric, formatMetric } from '../profile-facts';
import { ProfileRow } from './profile-row';
import type { ProfileEditorId, ProfileSection, StoredTrainingProfile } from './profile-contract';

export function ProfileDetails({ section, data, onEdit, onGoals, practiceTab, onPracticeTab }: {
  section: ProfileSection; data: StoredTrainingProfile; onEdit: (editor: ProfileEditorId) => void; onGoals: () => void;
  practiceTab: 'practices' | 'priorities'; onPracticeTab: (tab: 'practices' | 'priorities') => void;
}) {
  const { theme } = useReedTheme();
  const answers = data.trainingProfile.onboarding;
  if (!answers) return null;
  const weight = data.latestBodyMetrics.find(metric => metric.metricKey === 'body_weight');
  if (section === 'body') return <View style={{ gap: theme.spacing.lg }}>
    <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
      <Metric label="Age" value={String(new Date().getFullYear() - answers.birthYear)} unit="this year" onPress={() => onEdit('born')} />
      <Metric label="Height" value={formatMetric(answers.heightCm)} unit="cm" onPress={() => onEdit('height')} />
      <Metric label="Weight" value={formatMetric(weight?.value ?? answers.weightKg)} unit="kg" onPress={() => onEdit('weight')} />
    </View>
    <View>
      <ProfileRow title="Gender" value={SEX_OPTIONS.find(option => option.value === answers.sex)?.label} onPress={() => onEdit('sex')} />
      <ProfileRow title="Body reference" value={BODY_SHAPES.find(shape => shape.value === answers.shape)?.label} onPress={() => onEdit('shape')} />
      <ProfileRow icon="body-outline" title="Discomfort" detail={answers.bodyMapDone ? answers.discomfort.length ? answers.discomfort.slice(0, 2).map(p => `${regionLabel.get(p.regionId)} · ${PAIN_LABELS[p.intensity]}`).join('\n') : 'Nothing hurting' : 'Not yet answered'} value={answers.discomfort.length > 2 ? `+${answers.discomfort.length - 2}` : undefined} onPress={() => onEdit('bodymap')} />
    </View>
    {data.latestBodyMetrics.some(metric => metric.metricKey !== 'body_weight') ? <View style={{ gap: theme.spacing.sm }}>
      <ReedText tone="muted" variant="caption">Other measurements</ReedText>
      {data.latestBodyMetrics.filter(metric => metric.metricKey !== 'body_weight').map(metric => <View key={metric.metricKey} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}><ReedText tone="secondary" variant="caption">{metric.metricKey.replace(/_/g, ' ')}</ReedText><ReedText variant="caption">{formatBodyMetric(metric)}</ReedText></View>)}
    </View> : null}
  </View>;
  if (section === 'practices') return <View style={{ gap: theme.spacing.xl }}>
    <SegmentedControl value={practiceTab} onChange={onPracticeTab} options={[{ label: 'Practices', value: 'practices' }, { label: 'Priorities', value: 'priorities' }]} variant="card" />
    {practiceTab === 'practices' ? <View style={{ gap: theme.spacing.md }}>
      <View style={gridStyle}>{answers.practices.map(practice => <View key={practice.id} style={gridCell}><LevelTile label={practice.label} level={practice.level} onOpen={() => onEdit(`world:${practice.world}`)} /></View>)}</View>
      <ReedButton label="Add or change practices" variant="soft" onPress={() => onEdit('worlds')} />
      <ProfileRow title="Your goals" icon="flag-outline" detail="Dates, milestones and progress" onPress={onGoals} />
    </View> : <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><ReedText variant="headline">Your priorities</ReedText><ReedButton accessibilityLabel="Edit priorities" label="Edit" variant="quiet" onPress={() => onEdit('values')} /></View>
      {answers.values.length ? answers.values.map((id, index) => {
        const value = MOVE_VALUES.find(value => value.id === id)!;
        return <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xs }}>
          <View style={{ width: reedProfileMetrics.hit, height: reedProfileMetrics.hit, borderRadius: theme.radii.md, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={value.icon} size={22} color={String(theme.colors.accentInk)} /></View>
          <ReedText tone="accent" variant="caption">{index + 1}</ReedText><ReedText style={{ flex: 1 }} variant="body">{value.label}</ReedText>
        </View>;
      }) : <ReedText tone="secondary" variant="body">No priorities chosen yet.</ReedText>}
    </View>}
  </View>;
  if (section === 'training') return <View style={{ gap: theme.spacing.lg }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Your week" onPress={() => onEdit('week')} style={({ pressed }) => [{ gap: theme.spacing.sm }, getTapScaleStyle(pressed)]}>
      <ReedText variant="headline">Your week</ReedText>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xxs }}>{answers.days.map((state, index) => <View key={index} style={{ flex: 1, alignItems: 'center', minHeight: reedProfileMetrics.metricHeight, justifyContent: 'center', gap: theme.spacing.xs, borderRadius: theme.radii.sm, backgroundColor: state === 'fixed' ? theme.colors.accentSoft : theme.colors.surface }}>
        <ReedText tone={state === 'off' ? 'muted' : 'secondary'} variant="micro">{WEEKDAYS[index]}</ReedText><Ionicons name={state === 'fixed' ? 'barbell-outline' : state === 'off' ? 'moon-outline' : 'add-outline'} color={String(state === 'fixed' ? theme.colors.accentInk : theme.colors.inkMuted)} size={18} />
      </View>)}</View>
      <ReedText tone="muted" variant="caption">Tap to change availability or regular training.</ReedText>
    </Pressable>
    <View>
      <ProfileRow title="Coaching rhythm" value={RHYTHMS.find(rhythm => rhythm.id === answers.rhythm)?.title ?? 'Not answered'} detail={answers.rhythm === 'rotate' ? `${answers.blockWeeks}-week rotation` : undefined} onPress={() => onEdit('rhythm')} />
      <ProfileRow title="How hard to push" value={['Ease me in', 'Steady', 'Push me'][answers.push]} onPress={() => onEdit('push')} />
      <ProfileRow title="Sleep & recovery" detail={recoveryDescription(answers)} onPress={() => onEdit('sleep')} />
      <ProfileRow title="Your day" value={DAY_LOAD_OPTIONS.find(option => option.id === answers.dayLoad)?.title ?? 'Not answered'} onPress={() => onEdit('day')} />
      <ProfileRow title="Notes for Reed" detail={answers.notes ?? 'Anything else your coach should know'} onPress={() => onEdit('notes')} />
    </View>
  </View>;
  return null;
}

function Metric({ label, value, unit, onPress }: { label: string; value: string; unit: string; onPress: () => void }) {
  const { theme } = useReedTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onPress} style={({ pressed }) => [{ flex: 1, minWidth: 0, gap: theme.spacing.xxs, padding: theme.spacing.sm, minHeight: reedProfileMetrics.metricHeight, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }, getTapScaleStyle(pressed)]}>
    <ReedText tone="secondary" variant="caption">{label}</ReedText><ReedText variant="stat" numberOfLines={1}>{value}</ReedText><ReedText tone="muted" variant="micro">{unit}</ReedText>
  </Pressable>;
}
