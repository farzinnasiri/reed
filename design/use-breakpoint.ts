import { useWindowDimensions } from 'react-native';
import { reedBreakpoints } from '@/design/system';

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return {
    isCompact: width < reedBreakpoints.compact,
    width,
  };
}