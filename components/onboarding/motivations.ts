import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { MascotExpression } from '@/components/reed/mascot';

export type MoveValue = 'feel-good' | 'improve' | 'perform' | 'appearance' | 'longevity' | 'social' | 'adventure' | 'clear-head';
export const MOVE_VALUES: { id: MoveValue; label: string; icon: ComponentProps<typeof Ionicons>['name']; reaction: string; face: MascotExpression; guidance: string }[] = [
  { id: 'feel-good', label: 'Feel good in my body', icon: 'body-outline', reaction: 'Feeling good counts.', face: 'happy', guidance: 'Build sessions around feeling capable and moving comfortably.' },
  { id: 'improve', label: 'Get better at things', icon: 'trending-up-outline', reaction: 'Small improvements, kept.', face: 'proud', guidance: 'Protect time for skill practice and steady progression.' },
  { id: 'perform', label: 'Perform and compete', icon: 'trophy-outline', reaction: 'Something to bring your best to.', face: 'ready', guidance: 'Make performance practice a priority when time is tight.' },
  { id: 'appearance', label: 'Look the way I want', icon: 'accessibility-outline', reaction: 'Your body. Your call.', face: 'encouraging', guidance: 'Include strength work that supports your physique priorities.' },
  { id: 'longevity', label: 'Stay healthy for the long run', icon: 'heart-outline', reaction: 'I want you doing this for years.', face: 'encouraging', guidance: 'Start with conservative loads and protect recovery.' },
  { id: 'social', label: 'Be with people', icon: 'people-outline', reaction: 'A good class counts, too.', face: 'happy', guidance: 'Count social classes as training, not extra work to fit around it.' },
  { id: 'adventure', label: 'Adventure and challenge', icon: 'compass-outline', reaction: 'Leave room for the big days.', face: 'excited', guidance: 'Use trips as plan anchors when you add them.' },
  { id: 'clear-head', label: 'Clear my head', icon: 'leaf-outline', reaction: 'Some days, that is enough.', face: 'happy', guidance: 'Keep an easy session option for a difficult day.' },
];
export function toggleValue(values: MoveValue[], value: MoveValue): MoveValue[] {
  return values.includes(value) ? values.filter(entry => entry !== value) : values.length < 3 ? [...values, value] : values;
}
