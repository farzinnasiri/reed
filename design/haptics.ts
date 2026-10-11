import { Platform } from 'react-native';
import { createHapticPolicy } from './haptic-policy';
import { deliverHaptic } from './haptics-driver';

export const hapticPolicy = createHapticPolicy(deliverHaptic);
export const selection = () => hapticPolicy.emit('selection');
export const toggle = (value: boolean) => hapticPolicy.emit(value ? 'toggleOn' : 'toggleOff');
/** Native detents only; web acknowledges the final changed value. */
export const detent = () => { if (Platform.OS !== 'web') hapticPolicy.emit('detent'); };
export const settled = () => { if (Platform.OS === 'web') hapticPolicy.emit('settled'); };
export const light = () => hapticPolicy.emit('acknowledge');
export const saved = () => hapticPolicy.emit('saved');
export const success = () => hapticPolicy.emit('completed');
export const warning = () => hapticPolicy.emit('error');
export const reply = (id: string, completedAt?: number) => hapticPolicy.emit('reply', `reply:${id}`, completedAt);
export const replyFailed = (id: string, completedAt?: number) => hapticPolicy.emit('error', `reply-error:${id}:${completedAt ?? 'unknown'}`, completedAt);
export const attention = (id: string) => hapticPolicy.emit('attention', `attention:${id}`);
export const soft = () => hapticPolicy.emit('play');
