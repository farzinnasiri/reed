import type { ReactNode } from 'react';
import { View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
export function ThreadMask({ children, top, fade }: { children: ReactNode; top: number; fade: number }) {
  return <MaskedView style={{ flex: 1 }} androidRenderingMode="hardware" maskElement={<View style={{ flex: 1 }}><View style={{ height: top }} /><LinearGradient colors={['transparent', 'black']} style={{ height: fade }} /><View style={{ flex: 1, backgroundColor: 'black' }} /></View>}>{children}</MaskedView>;
}
