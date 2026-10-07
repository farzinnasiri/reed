import { View } from 'react-native';
import { useReedTheme } from '@/design/provider';
import { startingWeeklyTarget } from '@/domains/profile/onboarding';
import type { ProfileSection, StoredTrainingProfile } from './profile/profile-contract';
import { ProfileRow } from './profile/profile-row';

/** The first view shows destinations, not every answer in the profile. */
export function ProfileFacts({ profileData, onOpen }: { profileData: StoredTrainingProfile; onOpen: (section: ProfileSection) => void }) {
  const { theme } = useReedTheme();
  const answers = profileData.trainingProfile.onboarding;
  if (!answers) return null;
  const weight = profileData.latestBodyMetrics.find(metric => metric.metricKey === 'body_weight');
  const target = startingWeeklyTarget(answers);
  return <View style={{ gap: theme.spacing.xxs }}>
    <ProfileRow icon="body-outline" title="Body" detail={`${new Date().getFullYear() - answers.birthYear} this year · ${answers.heightCm} cm · ${formatBodyMetric(weight ?? { value: answers.weightKg, unit: 'kg' })}`} onPress={() => onOpen('body')} />
    <ProfileRow icon="barbell-outline" title="Practices & priorities" detail={`${answers.practices.length} ${answers.practices.length === 1 ? 'practice' : 'practices'}${answers.values.length ? ` · ${answers.values.length} priorities` : ''}`} onPress={() => onOpen('practices')} />
    <ProfileRow icon="calendar-outline" title="Coaching & week" detail={target ? `${target} active ${target === 1 ? 'day' : 'days'} a week` : 'No active days scheduled'} onPress={() => onOpen('training')} />
  </View>;
}

export function formatMetric(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
export function formatBodyMetric(metric: { unit?: string; value: number } | undefined) {
  if (!metric) return 'Not set';
  const unit = metric.unit === 'percent' ? '%' : metric.unit ?? '';
  return `${formatMetric(metric.value)}${unit === '%' ? unit : unit ? ` ${unit}` : ''}`;
}
