import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { ReedText } from './reed-text';

type AnalyticsDonutSegment = {
  color: string;
  id: string;
  percent: number;
};

type AnalyticsDonutProps = {
  centerPrimary: string;
  centerPrimaryStyle?: StyleProp<TextStyle>;
  centerSecondary: string;
  centerSecondaryStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  emptyColor?: string;
  segments: AnalyticsDonutSegment[];
  size: number;
  strokeWidth: number;
  wrapStyle?: StyleProp<ViewStyle>;
};

export function AnalyticsDonut({
  centerPrimary,
  centerPrimaryStyle,
  centerSecondary,
  centerSecondaryStyle,
  containerStyle,
  emptyColor = '#94a3b8',
  segments,
  size,
  strokeWidth,
  wrapStyle,
}: AnalyticsDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetCursor = 0;
  const visibleSegments = segments.filter(segment => segment.percent > 0);

  return (
    <View style={[defaultStyles.container, containerStyle]}>
      <View style={[defaultStyles.wrap, wrapStyle]}>
        <Svg height={size} width={size}>
          <G origin={`${center}, ${center}`} rotation={-90}>
            {visibleSegments.length > 0 ? (
              visibleSegments.map(segment => {
                const ratio = Math.max(0, segment.percent / 100);
                const dashLength = circumference * ratio;
                const dashGap = circumference - dashLength;
                const circle = (
                  <Circle
                    cx={center}
                    cy={center}
                    fill="none"
                    key={segment.id}
                    r={radius}
                    stroke={segment.color}
                    strokeDasharray={`${dashLength} ${dashGap}`}
                    strokeDashoffset={-offsetCursor}
                    strokeLinecap="butt"
                    strokeWidth={strokeWidth}
                  />
                );
                offsetCursor += dashLength;
                return circle;
              })
            ) : (
              <Circle
                cx={center}
                cy={center}
                fill="none"
                r={radius}
                stroke={emptyColor}
                strokeOpacity={0.3}
                strokeWidth={strokeWidth}
              />
            )}
          </G>
        </Svg>
        <View style={defaultStyles.center}>
          <ReedText style={centerPrimaryStyle} variant="section">
            {centerPrimary}
          </ReedText>
          <ReedText style={centerSecondaryStyle} tone="muted" variant="caption">
            {centerSecondary}
          </ReedText>
        </View>
      </View>
    </View>
  );
}

const defaultStyles = {
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  } satisfies ViewStyle,
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  } satisfies ViewStyle,
};
