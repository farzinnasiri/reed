import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { PanGestureHandler } from 'react-native-gesture-handler';
import type { PanGestureHandlerProps } from 'react-native-gesture-handler';
import type { PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';

type EditableImage = {
  height?: number;
  name?: string;
  uri: string;
  width?: number;
};

type WorkingImage = Required<Pick<EditableImage, 'uri'>> & {
  height?: number;
  name?: string;
  width?: number;
};

type EditorImageResult = {
  height: number;
  name?: string;
  uri: string;
  width: number;
};

type CropRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type Stroke = {
  color: string;
  id: string;
  points: Array<{ x: number; y: number }>;
  width: number;
};

type CropHandle = 'move' | 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

type Props = {
  image: EditableImage | null;
  onCancel: () => void;
  onUseImage: (result: EditorImageResult) => void;
  visible: boolean;
};

type PanStateEvent = Parameters<NonNullable<PanGestureHandlerProps['onBegan']>>[0];
type PanGestureEvent = Parameters<NonNullable<PanGestureHandlerProps['onGestureEvent']>>[0];

const CAPTURE_QUALITY = 0.92;
const MIN_CROP_SIZE = 72;
const BRUSH_SIZES = [4, 8, 12, 18];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pathForPoints(points: Stroke['points']) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function createInitialCrop(width: number, height: number): CropRect {
  return { height, width, x: 0, y: 0 };
}

function pointInRect(x: number, y: number, rect: CropRect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function nearestCropHandle(x: number, y: number, rect: CropRect): CropHandle {
  type MeasuredHandle = { distance: number; handle: CropHandle; x: number; y: number };
  const handles: Array<{ handle: CropHandle; x: number; y: number }> = [
    { handle: 'topLeft', x: rect.x, y: rect.y },
    { handle: 'topRight', x: rect.x + rect.width, y: rect.y },
    { handle: 'bottomRight', x: rect.x + rect.width, y: rect.y + rect.height },
    { handle: 'bottomLeft', x: rect.x, y: rect.y + rect.height },
  ];
  const nearest = handles.reduce<MeasuredHandle>((best, item) => {
    const distance = Math.hypot(item.x - x, item.y - y);
    return distance < best.distance ? { ...item, distance } : best;
  }, { ...handles[0], distance: Number.POSITIVE_INFINITY });
  if (nearest.distance <= 64) return nearest.handle;
  return pointInRect(x, y, rect) ? 'move' : 'bottomRight';
}

function cropWithHandle(handle: CropHandle, rect: CropRect, dx: number, dy: number, bounds: { height: number; width: number }): CropRect {
  if (handle === 'move') {
    return {
      ...rect,
      x: clamp(rect.x + dx, 0, bounds.width - rect.width),
      y: clamp(rect.y + dy, 0, bounds.height - rect.height),
    };
  }

  let left = rect.x;
  let right = rect.x + rect.width;
  let top = rect.y;
  let bottom = rect.y + rect.height;

  if (handle === 'topLeft' || handle === 'bottomLeft') left = clamp(left + dx, 0, right - MIN_CROP_SIZE);
  if (handle === 'topRight' || handle === 'bottomRight') right = clamp(right + dx, left + MIN_CROP_SIZE, bounds.width);
  if (handle === 'topLeft' || handle === 'topRight') top = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
  if (handle === 'bottomLeft' || handle === 'bottomRight') bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, bounds.height);

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}

function panPayload(event: PanGestureEvent | PanStateEvent) {
  return event.nativeEvent as unknown as Readonly<PanGestureHandlerEventPayload>;
}

export function ReedImageEditor({ image, onCancel, onUseImage, visible }: Props) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { theme } = useReedTheme();
  const captureViewRef = useRef<View | null>(null);
  const cropGestureRef = useRef<{ handle: CropHandle; rect: CropRect } | null>(null);
  const paintGestureRef = useRef<string | null>(null);
  const [mode, setMode] = useState<'crop' | 'paint'>('crop');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [paintColorIndex, setPaintColorIndex] = useState(0);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isExporting, setIsExporting] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [measuredSize, setMeasuredSize] = useState<{ height: number; width: number } | null>(null);
  const [workingImage, setWorkingImage] = useState<WorkingImage | null>(image);
  const [cropHistory, setCropHistory] = useState<WorkingImage[]>([]);
  const activeImage = workingImage ?? image;
  const paintColors = useMemo(() => [
    String(theme.colors.accentPrimary),
    String(theme.colors.accentSecondary),
    String(theme.colors.dangerText),
    String(theme.colors.textPrimary),
  ], [theme.colors.accentPrimary, theme.colors.accentSecondary, theme.colors.dangerText, theme.colors.textPrimary]);
  const paintColor = paintColors[paintColorIndex] ?? paintColors[0];

  useEffect(() => {
    setBrushSize(BRUSH_SIZES[1]);
    setCropRect(null);
    setCropHistory([]);
    setMeasuredSize(null);
    setMode('paint');
    setPaintColorIndex(0);
    setStrokes([]);
    setWorkingImage(image);
  }, [image?.uri]);

  useEffect(() => {
    if (!activeImage?.uri || (activeImage.width && activeImage.height)) return;
    Image.getSize(
      activeImage.uri,
      (width, height) => setMeasuredSize({ height, width }),
      () => setMeasuredSize(null),
    );
  }, [activeImage?.height, activeImage?.uri, activeImage?.width]);

  const displaySize = useMemo(() => {
    const sourceWidth = activeImage?.width && activeImage.width > 0 ? activeImage.width : measuredSize?.width ?? 1;
    const sourceHeight = activeImage?.height && activeImage.height > 0 ? activeImage.height : measuredSize?.height ?? 1;
    const maxWidth = Math.max(1, windowWidth - 32);
    const maxHeight = Math.max(1, windowHeight * 0.56);
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    return {
      height: Math.round(sourceHeight * scale),
      width: Math.round(sourceWidth * scale),
    };
  }, [activeImage?.height, activeImage?.width, measuredSize?.height, measuredSize?.width, windowHeight, windowWidth]);

  const activeCropRect = cropRect ?? createInitialCrop(displaySize.width, displaySize.height);
  const sourceSize = {
    height: activeImage?.height && activeImage.height > 0 ? activeImage.height : measuredSize?.height ?? displaySize.height,
    width: activeImage?.width && activeImage.width > 0 ? activeImage.width : measuredSize?.width ?? displaySize.width,
  };

  function handleCropGestureStart(event: PanStateEvent) {
    const { x, y } = panPayload(event);
    cropGestureRef.current = {
      handle: nearestCropHandle(x, y, activeCropRect),
      rect: activeCropRect,
    };
  }

  function handleCropGesture(event: PanGestureEvent) {
    const gestureState = cropGestureRef.current;
    if (!gestureState) return;
    const { translationX, translationY } = panPayload(event);
    setCropRect(cropWithHandle(
      gestureState.handle,
      gestureState.rect,
      translationX,
      translationY,
      displaySize,
    ));
  }

  function clearCropGesture() {
    cropGestureRef.current = null;
  }

  function beginPaintStroke(event: PanStateEvent) {
    const { x, y } = panPayload(event);
    const point = {
      x: clamp(x, 0, displaySize.width),
      y: clamp(y, 0, displaySize.height),
    };
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    paintGestureRef.current = id;
    setStrokes(current => current.concat({
      color: paintColor,
      id,
      points: [point],
      width: brushSize,
    }));
  }

  function handlePaintGesture(event: PanGestureEvent) {
    const id = paintGestureRef.current;
    if (!id) return;
    const { x, y } = panPayload(event);
    const point = {
      x: clamp(x, 0, displaySize.width),
      y: clamp(y, 0, displaySize.height),
    };
    setStrokes(current => current.map(stroke => stroke.id === id
      ? { ...stroke, points: stroke.points.concat(point) }
      : stroke));
  }

  function clearPaintGesture() {
    paintGestureRef.current = null;
  }

  async function capturePaintCanvas() {
    if (!captureViewRef.current) return null;
    return await captureRef(captureViewRef.current, {
      format: 'jpg',
      quality: CAPTURE_QUALITY,
      result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
    });
  }

  async function cropActiveImage(rect: CropRect) {
    if (!activeImage) return null;
    const scaleX = sourceSize.width / displaySize.width;
    const scaleY = sourceSize.height / displaySize.height;
    const originX = Math.round(clamp(rect.x * scaleX, 0, sourceSize.width - 1));
    const originY = Math.round(clamp(rect.y * scaleY, 0, sourceSize.height - 1));
    const cropWidth = Math.round(clamp(rect.width * scaleX, 1, sourceSize.width - originX));
    const cropHeight = Math.round(clamp(rect.height * scaleY, 1, sourceSize.height - originY));

    return await ImageManipulator.manipulateAsync(
      activeImage.uri,
      [{ crop: { height: cropHeight, originX, originY, width: cropWidth } }],
      { compress: CAPTURE_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
  }

  async function applyCrop() {
    if (!activeImage) return;
    setIsApplyingCrop(true);
    try {
      const cropped = await cropActiveImage(activeCropRect);
      if (!cropped) return;
      setWorkingImage({
        height: cropped.height,
        name: activeImage.name,
        uri: cropped.uri,
        width: cropped.width,
      });
      setCropHistory(current => current.concat(activeImage));
      setCropRect(null);
      setMeasuredSize(null);
      setMode('paint');
      setStrokes([]);
    } finally {
      setIsApplyingCrop(false);
    }
  }

  async function exportEditedImage() {
    if (!activeImage || !captureViewRef.current) return;
    setIsExporting(true);
    try {
      if (mode === 'crop') {
        const cropped = await cropActiveImage(activeCropRect);
        if (!cropped) return;
        onUseImage({
          height: cropped.height,
          name: activeImage.name,
          uri: cropped.uri,
          width: cropped.width,
        });
        return;
      }

      const uri = await capturePaintCanvas();
      if (!uri) return;
      onUseImage({
        height: displaySize.height,
        name: activeImage.name,
        uri,
        width: displaySize.width,
      });
    } finally {
      setIsExporting(false);
    }
  }

  function restoreOriginalImage() {
    if (!image) return;
    setWorkingImage(image);
    setCropHistory([]);
    setCropRect(null);
    setMeasuredSize(null);
    setMode('paint');
    setStrokes([]);
  }

  if (!image || !activeImage) return null;

  return (
    <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="fullScreen" visible={visible}>
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cancel image edit" onPress={onCancel} style={styles.iconButton}>
            <Ionicons color={String(theme.colors.textPrimary)} name="close" size={24} />
          </Pressable>
          <ReedText variant="bodyStrong">Edit photo</ReedText>
          <Pressable
            accessibilityLabel="Use edited image"
            disabled={isExporting}
            onPress={() => void exportEditedImage()}
            style={[styles.useButton, { backgroundColor: theme.colors.accentPrimary }]}
          >
            {isExporting ? (
              <ActivityIndicator color={String(theme.colors.accentPrimaryText)} size="small" />
            ) : (
              <Ionicons color={String(theme.colors.accentPrimaryText)} name="checkmark" size={22} />
            )}
          </Pressable>
        </View>

        <View style={styles.stage}>
          <View
            style={[styles.canvas, { height: displaySize.height, width: displaySize.width }]}
          >
            <Image resizeMode="stretch" source={{ uri: activeImage.uri }} style={StyleSheet.absoluteFill} />
            <Svg height={displaySize.height} style={[StyleSheet.absoluteFill, styles.noPointerEvents]} width={displaySize.width}>
              {strokes.map(stroke => (
                <Path
                  d={pathForPoints(stroke.points)}
                  fill="none"
                  key={stroke.id}
                  stroke={stroke.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={stroke.width}
                />
              ))}
            </Svg>
            {mode === 'crop' ? (
              <CropOverlay
                borderColor={String(theme.colors.accentPrimaryText)}
                cropRect={activeCropRect}
              />
            ) : null}
            {mode === 'paint' && cropHistory.length > 0 ? (
              <Pressable
                accessibilityLabel="Restore original image"
                onPress={restoreOriginalImage}
                style={[
                  styles.imageResetButton,
                  {
                    backgroundColor: theme.colors.controlFill,
                    borderColor: theme.colors.controlBorder,
                  },
                ]}
              >
                <Ionicons color={String(theme.colors.textPrimary)} name="refresh" size={17} />
                <ReedText variant="caption">Reset</ReedText>
              </Pressable>
            ) : null}
            {mode === 'crop' ? (
              <PanGestureHandler
                activeCursor="move"
                avgTouches
                maxPointers={1}
                minDist={0}
                onBegan={handleCropGestureStart}
                onCancelled={clearCropGesture}
                onEnded={clearCropGesture}
                onFailed={clearCropGesture}
                onGestureEvent={handleCropGesture}
                shouldCancelWhenOutside={false}
                touchAction="none"
                userSelect="none"
              >
                <View style={styles.gestureLayer} />
              </PanGestureHandler>
            ) : (
              <PanGestureHandler
                activeCursor="crosshair"
                avgTouches
                maxPointers={1}
                minDist={0}
                onBegan={beginPaintStroke}
                onCancelled={clearPaintGesture}
                onEnded={clearPaintGesture}
                onFailed={clearPaintGesture}
                onGestureEvent={handlePaintGesture}
                shouldCancelWhenOutside={false}
                touchAction="none"
                userSelect="none"
              >
                <View style={styles.gestureLayer} />
              </PanGestureHandler>
            )}
          </View>
        </View>

        <View style={styles.tools}>
              <View style={[styles.segment, { backgroundColor: theme.colors.controlFill }]}>
            <ToolButton
              active={mode === 'crop'}
              icon="crop-outline"
              label="Crop"
              onPress={() => {
                setCropRect(null);
                setMode('crop');
              }}
            />
            <ToolButton
              active={mode === 'paint'}
              icon="brush-outline"
              label="Paint"
              onPress={() => {
                setCropRect(null);
                setMode('paint');
              }}
            />
          </View>

          {mode === 'paint' ? (
            <View style={styles.paintControls}>
              <View style={styles.swatches}>
                {paintColors.map((color, index) => (
                  <Pressable
                    accessibilityLabel={`Paint color ${color}`}
                    key={color}
                    onPress={() => setPaintColorIndex(index)}
                    style={[
                      styles.swatch,
                      { backgroundColor: color, borderColor: paintColorIndex === index ? theme.colors.textPrimary : theme.colors.borderSoft },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.brushes}>
                {BRUSH_SIZES.map(size => (
                  <Pressable
                    accessibilityLabel={`Brush size ${size}`}
                    key={size}
                    onPress={() => setBrushSize(size)}
                    style={[
                      styles.brushButton,
                      { borderColor: brushSize === size ? theme.colors.textPrimary : theme.colors.borderSoft },
                    ]}
                  >
                    <View style={{ backgroundColor: theme.colors.textPrimary, borderRadius: size / 2, height: size, width: size }} />
                  </Pressable>
                ))}
                <Pressable accessibilityLabel="Undo paint stroke" onPress={() => setStrokes(current => current.slice(0, -1))} style={styles.iconButton}>
                  <Ionicons color={String(theme.colors.textPrimary)} name="arrow-undo" size={20} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.cropHint}>
              <View style={styles.cropActions}>
                <Pressable
                  accessibilityLabel="Cancel crop"
                  onPress={() => {
                    setCropRect(null);
                    setMode('paint');
                  }}
                  style={[styles.cropActionButton, { borderColor: theme.colors.controlBorder }]}
                >
                  <ReedText variant="caption">Cancel</ReedText>
                </Pressable>
                <Pressable
                  accessibilityLabel="Apply crop"
                  disabled={isApplyingCrop}
                  onPress={() => void applyCrop()}
                  style={[styles.cropActionButton, { backgroundColor: theme.colors.controlActiveFill, borderColor: theme.colors.controlBorder }]}
                >
                  {isApplyingCrop ? (
                    <ActivityIndicator color={String(theme.colors.textPrimary)} size="small" />
                  ) : (
                    <>
                      <Ionicons color={String(theme.colors.textPrimary)} name="checkmark" size={18} />
                      <ReedText variant="caption">Apply</ReedText>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View
          collapsable={false}
          ref={captureViewRef}
          style={[
            styles.captureCanvas,
            {
              height: displaySize.height,
              left: -10000,
              top: 0,
              width: displaySize.width,
            },
          ]}
        >
          <Image
            resizeMode="stretch"
            source={{ uri: activeImage.uri }}
            style={{
              height: displaySize.height,
              left: 0,
              position: 'absolute',
              top: 0,
              width: displaySize.width,
            }}
          />
          <Svg
            height={displaySize.height}
            style={[styles.noPointerEvents, { left: 0, position: 'absolute', top: 0 }]}
            width={displaySize.width}
          >
            {strokes.map(stroke => (
              <Path
                d={pathForPoints(stroke.points)}
                fill="none"
                key={stroke.id}
                stroke={stroke.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={stroke.width}
              />
            ))}
          </Svg>
        </View>
      </View>
    </Modal>
  );
}

function CropOverlay({
  borderColor,
  cropRect,
}: {
  borderColor: string;
  cropRect: CropRect;
}) {
  const cropFrameStyle = {
    height: cropRect.height,
    left: cropRect.x,
    top: cropRect.y,
    width: cropRect.width,
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.noPointerEvents]}>
      <View style={[styles.cropFrame, cropFrameStyle, { borderColor }]}>
        <View style={[styles.cropHandle, styles.cropHandleTopLeft, { backgroundColor: borderColor }]} />
        <View style={[styles.cropHandle, styles.cropHandleTopRight, { backgroundColor: borderColor }]} />
        <View style={[styles.cropHandle, styles.cropHandleBottomRight, { backgroundColor: borderColor }]} />
        <View style={[styles.cropHandle, styles.cropHandleBottomLeft, { backgroundColor: borderColor }]} />
      </View>
    </View>
  );
}

function ToolButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const { theme } = useReedTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.toolButton, active ? { backgroundColor: theme.colors.controlActiveFill } : null]}
    >
      <Ionicons color={String(active ? theme.colors.textPrimary : theme.colors.textMuted)} name={icon} size={18} />
      <ReedText tone={active ? 'default' : 'muted'} variant="caption">{label}</ReedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cropActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  cropActionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  brushes: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  brushButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  canvas: {
    overflow: 'visible',
  },
  captureCanvas: {
    overflow: 'hidden',
    position: 'absolute',
  },
  cropFrame: {
    borderWidth: 2,
    position: 'absolute',
  },
  cropHandle: {
    borderRadius: 6,
    height: 12,
    position: 'absolute',
    width: 12,
  },
  cropHandleBottomLeft: {
    bottom: -6,
    left: -6,
  },
  cropHandleBottomRight: {
    bottom: -6,
    right: -6,
  },
  cropHandleTopLeft: {
    left: -6,
    top: -6,
  },
  cropHandleTopRight: {
    right: -6,
    top: -6,
  },
  cropHint: {
    alignItems: 'center',
    gap: 14,
    height: 116,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  gestureLayer: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    touchAction: 'none',
    userSelect: 'none',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  imageResetButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    height: 36,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 3,
  },
  paintControls: {
    gap: 14,
    height: 116,
    justifyContent: 'center',
  },
  noPointerEvents: {
    pointerEvents: 'none',
  },
  root: {
    flex: 1,
  },
  segment: {
    alignSelf: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  stage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  swatch: {
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    width: 36,
  },
  swatches: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  toolButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  tools: {
    gap: 16,
    height: 204,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  useButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 54,
  },
});
