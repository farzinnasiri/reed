import Svg, { Circle } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';

type WorkoutRestRingProps = {
  durationSeconds: number;
  isRunning: boolean;
  remainingSeconds: number;
  size?: number;
  strokeWidth?: number;
};

export function WorkoutRestRing({
  durationSeconds,
  isRunning,
  remainingSeconds,
  size = 228,
  strokeWidth = 14,
}: WorkoutRestRingProps) {
  const { theme } = useReedTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress =
    durationSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / durationSeconds)) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[styles.shell, { height: size, width: size }]}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={String(theme.colors.accentPrimary)}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.copy}>
        <ReedText
          style={{
            color: theme.colors.textPrimary,
            fontSize: Math.round(size * 0.3),
            letterSpacing: -2,
            lineHeight: Math.round(size * 0.28),
          }}
          variant="display"
        >
          {formatSeconds(remainingSeconds)}
        </ReedText>
        <ReedText style={{ color: theme.colors.textMuted }} variant="section">
          {isRunning ? 'Tap to pause' : 'Tap to start'}
        </ReedText>
      </View>
    </View>
  );
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
  },
});
