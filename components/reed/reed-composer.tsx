import { useComposerVoiceLevel } from './reed-composer-context';
import { ReedSheetTextInput } from '@/components/ui/reed-sheet-input';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Image, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { getTapScaleStyle, reedLayoutTransitions, reedMotion, reedReanimatedEasing, reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedComposerMetrics as metrics, withColorAlpha } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { restoreHiddenComposerAncestors, useComposerFocusRetention } from './use-composer-focus-retention';
import { styles } from './reed.styles';
import type { ReedDraftAttachment, VoiceComposerState } from './reed.types';
import { ComposerHalo } from './presence/composer-halo';

export type ComposerMenuAnchor = { x: number; y: number; width: number; height: number };

type ReedComposerProps = {
  attachments: { items: ReedDraftAttachment[]; preparing: boolean; error: string | null; remove: (id: string) => void };
  draft: { seed: { revision: number; text: string }; change: (text: string) => void; send: (text: string) => boolean };
  interaction: { focused: boolean; menuOpen: boolean; sheet?: boolean; focus: (focused: boolean) => void; openMenu: (anchor: ComposerMenuAnchor) => void };
  inputRef: RefObject<TextInput | null>;
  waiting: boolean;
  voice: { state: VoiceComposerState; start: () => void; stop: () => void; retry: () => void };
};

/** Retain the editor when a web control receives a pointer press. */
export function retainComposerFocus(event: GestureResponderEvent) {
  if (Platform.OS === 'web') event.preventDefault();
}

export function ReedComposer({ attachments, draft, interaction, inputRef, waiting, voice }: ReedComposerProps) {
  const { theme } = useReedTheme();
  const Input = interaction.sheet ? ReedSheetTextInput : TextInput;
  const reduced = useReedReducedMotion();
  const { fontScale } = useWindowDimensions();
  const lineHeight = metrics.inputLineHeight * fontScale;
  const maxHeight = lineHeight * metrics.inputMaxLines;
  const text = draft.seed.text;
  const [contentHeight, setContentHeight] = useState(lineHeight);
  const plusRef = useRef<View>(null);
  const cardRef = useRef<View>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  useComposerFocusRetention(cardRef);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pop = useSharedValue(1);
  const rim = useSharedValue(0);
  const plus = useSharedValue(0);
  const clearAccent = withColorAlpha(String(theme.colors.accent), 0);
  const recording = voice.state.status === 'listening';
  const transcribing = voice.state.status === 'transcribing';
  const readyAttachments = attachments.items.some(item => item.status === 'ready');
  const hasPayload = text.trim().length > 0 || readyAttachments;
  const showSend = hasPayload && !recording && !transcribing;
  const inputHeight = text ? Math.min(maxHeight, Math.max(lineHeight, contentHeight)) : lineHeight;

  useEffect(() => {
    rim.set(withTiming(interaction.focused ? (hasPayload ? metrics.draftRingAlpha : metrics.focusRingAlpha) : 0, { duration: reedMotion.durations.standard }));
    plus.set(reduced ? (interaction.menuOpen ? 1 : 0) : withSpring(interaction.menuOpen ? 1 : 0, reedSprings.pop));
  }, [hasPayload, interaction.focused, interaction.menuOpen, plus, reduced, rim]);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  function popOnTouch() {
    if (reduced || interaction.focused) return;
    pop.set(withSequence(withTiming(reedMotion.composer.focusScale, { duration: reedMotion.composer.focusMs }), withSpring(1, reedSprings.pop)));
  }
  function focus() {
    restoreHiddenComposerAncestors(inputRef.current);
    if (blurTimer.current) clearTimeout(blurTimer.current);
    popOnTouch();
    interaction.focus(true);
  }
  function blur() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => interaction.focus(false), reedMotion.composer.blurDelayMs);
  }
  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(rim.get(), [0, 1], [clearAccent, String(theme.colors.accent)]),
    transform: [{ scale: reduced ? 1 : pop.get() }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: rim.get() / (hasPayload ? metrics.draftRingAlpha : metrics.focusRingAlpha) * (hasPayload ? metrics.draftHaloAlpha : metrics.focusHaloAlpha) }));
  const plusStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${plus.get() * 45}deg` }] }));

  return (
    <View>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }, haloStyle]}><ComposerHalo width={cardSize.width} height={cardSize.height} radius={inputHeight > lineHeight ? metrics.multilineRadius : metrics.radius} /></Animated.View>
    <Animated.View
      ref={cardRef}
      onLayout={e => { const { width, height } = e.nativeEvent.layout; setCardSize(current => current.width === width && current.height === height ? current : { width, height }); }}
      layout={reduced ? undefined : reedLayoutTransitions.smooth}
      style={[styles.composerCard, { backgroundColor: theme.colors.surface, borderRadius: inputHeight > lineHeight ? metrics.multilineRadius : metrics.radius }, cardStyle]}
    >
      {attachments.items.length ? <AttachmentTray attachments={attachments.items} onRemoveAttachment={attachments.remove} /> : null}
      {attachments.error ? <ReedText tone="danger" variant="caption">{attachments.error}</ReedText> : null}
      {voice.state.status === 'failed' ? <ReedText tone="danger" variant="caption">{voice.state.error ?? 'Could not transcribe audio. Try again or type your message.'}</ReedText> : null}
      <View style={styles.composerInputRow}>
        <Pressable
          accessibilityHint="Opens quick log and photo attachments."
          accessibilityLabel="More actions"
          accessibilityRole="button"
          accessibilityState={{ expanded: interaction.menuOpen }}
          hitSlop={4}
          onPressIn={retainComposerFocus}
          onPress={() => plusRef.current?.measureInWindow((x, _y, width) => cardRef.current?.measureInWindow((_x, y, _width, height) => interaction.openMenu({ x, y, width, height })))}
          ref={plusRef}
          style={({ pressed }) => [styles.composerControl, getTapScaleStyle(pressed)]}
        >
          <Animated.View style={plusStyle}><Ionicons color={String(theme.colors.inkSecondary)} name="add" size={22} /></Animated.View>
        </Pressable>
        <Animated.View layout={reduced ? undefined : reedLayoutTransitions.smooth} style={[styles.composerInputFrame, { height: Math.max(metrics.control, inputHeight) }]}>
          {transcribing ? <ReedText tone="muted" variant="caption">Transcribing voice…</ReedText> : (
            <Input
              accessibilityHint="Type a question about training, recovery, or your next session."
              accessibilityLabel="Message Reed"
              accessibilityState={{ disabled: recording }}
              editable={!recording}
              multiline
              onBlur={blur}
              onChangeText={next => { if (!next) setContentHeight(lineHeight); draft.change(next); }}
              onContentSizeChange={event => setContentHeight(Math.ceil(event.nativeEvent.contentSize.height))}
              onFocus={focus}
              onPressIn={popOnTouch}
              placeholder="Talk to Reed"
              placeholderTextColor={String(theme.colors.inkMuted)}
              ref={node => {
                // Gorhom forwards the native input, but its public ref type names the RNGH component factory.
                inputRef.current = node as TextInput | null;
              }}
              scrollEnabled={contentHeight > maxHeight}
              style={[styles.composerInput, { color: String(theme.colors.ink), fontFamily: theme.typography.body.fontFamily, fontSize: metrics.inputFontSize, height: inputHeight, lineHeight: metrics.inputLineHeight, maxHeight }]}
              value={text}
            />
          )}
        </Animated.View>
        <ComposerAction
          preparing={attachments.preparing}
          showSend={showSend}
          voice={voice}
          waiting={waiting}
          onSend={() => { if (draft.send(text)) inputRef.current?.focus(); }}
        />
      </View>
    </Animated.View></View>
  );
}

function ComposerAction({ onSend, preparing, showSend, voice, waiting }: {
  onSend: () => void;
  preparing: boolean;
  showSend: boolean;
  voice: ReedComposerProps['voice'];
  waiting: boolean;
}) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const progress = useSharedValue(showSend ? 1 : 0);
  const fade = useSharedValue(showSend ? 1 : 0);
  const shake = useSharedValue(0);
  const active = useSharedValue(waiting || preparing ? 0.4 : 1);
  const recording = voice.state.status === 'listening';
  const transcribing = voice.state.status === 'transcribing';
  const failed = voice.state.status === 'failed';
  useEffect(() => {
    progress.set(reduced ? (showSend ? 1 : 0) : withSpring(showSend ? 1 : 0, reedSprings.pop));
    fade.set(withTiming(showSend ? 1 : 0, { duration: reedMotion.composer.iconFadeMs }));
  }, [fade, progress, reduced, showSend]);
  useEffect(() => { active.set(withTiming(waiting || preparing ? 0.4 : 1, { duration: reedMotion.durations.standard })); }, [active, preparing, waiting]);
  const buttonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fade.get(), [0, 1], [String(theme.colors.surfaceRaised), String(theme.colors.accent)]),
    opacity: showSend ? active.get() : 1,
    transform: [{ translateX: reduced ? 0 : shake.get() }],
  }));
  const micStyle = useAnimatedStyle(() => ({ opacity: 1 - fade.get(), transform: [{ scale: reduced ? 1 : 1 - progress.get() * (1 - reedMotion.composer.iconFromScale) }] }));
  const sendStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ scale: reduced ? 1 : reedMotion.composer.iconFromScale + progress.get() * (1 - reedMotion.composer.iconFromScale) }] }));
  function press() {
    if (showSend) {
      if (waiting || preparing) {
        haptics.selection();
        if (!reduced) {
          const timing = { duration: reedMotion.composer.refusedMs / 4, easing: reedReanimatedEasing.easeOut };
          shake.set(withSequence(withTiming(reedMotion.composer.refusedX, timing), withTiming(-reedMotion.composer.refusedX, timing), withTiming(reedMotion.composer.refusedX, timing), withTiming(0, timing)));
        }
      } else onSend();
    } else if (recording) voice.stop();
    else if (failed) voice.retry();
    else { haptics.light(); voice.start(); }
  }
  return (
    <Animated.View style={[styles.composerControl, buttonStyle]}>
      <Pressable
        accessibilityHint={showSend && waiting ? 'Reed is answering. Your draft stays here until you send it.' : showSend ? 'Sends your message to Reed.' : 'Record a message, then review its transcript before sending.'}
        accessibilityLabel={showSend ? 'Send message' : recording ? 'Stop voice mode' : transcribing ? 'Transcribing voice' : failed ? 'Retry voice transcription' : 'Start voice mode'}
        accessibilityRole="button"
        accessibilityState={{ busy: transcribing || (showSend && waiting), disabled: transcribing }}
        disabled={transcribing}
        hitSlop={4}
        onPress={press}
        onPressIn={retainComposerFocus}
        style={({ pressed }) => [styles.composerControl, getTapScaleStyle(pressed)]}
      >
        <Animated.View style={[{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }, micStyle]}>
          <View style={styles.voiceButtonContent}>
            <Ionicons color={String(theme.colors.inkSecondary)} name={recording ? 'stop' : transcribing ? 'sync-outline' : failed ? 'refresh' : 'mic-outline'} size={recording ? 12 : 18} />
            {recording ? <SharedVoiceButtonMeter /> : null}
          </View>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute' }, sendStyle]}><Ionicons color={String(theme.colors.accentText)} name="arrow-up" size={20} /></Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function AttachmentTray({
  attachments,
  onRemoveAttachment,
}: {
  attachments: ReedDraftAttachment[];
  onRemoveAttachment: (attachmentId: string) => void;
}) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.attachmentTray}>
      <ScrollView
        contentContainerStyle={styles.attachmentPreviewContent}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {attachments.map(attachment => (
          <View
            key={attachment.id}
            style={[
              styles.attachmentPreview,
              {
                backgroundColor: theme.colors.surfaceRaised,
                borderColor: attachment.status === 'failed' ? theme.colors.dangerBorder : 'transparent',
              },
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={{ uri: attachment.uri }}
              style={styles.attachmentImage}
            />
            {attachment.status !== 'ready' ? (
              <View style={styles.attachmentStatusOverlay}>
                <Ionicons
                  color={String(theme.colors.accentText)}
                  name={attachment.status === 'failed' ? 'warning-outline' : 'sync-outline'}
                  size={16}
                />
              </View>
            ) : null}
            <Pressable
              accessibilityLabel={`Remove ${attachment.name}`}
              accessibilityRole="button"
              onPress={() => onRemoveAttachment(attachment.id)}
              style={({ pressed }) => [
                styles.attachmentRemoveButton,
                { backgroundColor: theme.colors.canvas },
                getTapScaleStyle(pressed),
              ]}
            >
              <Ionicons color={String(theme.colors.ink)} name="close" size={13} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function VoiceButtonMeter({ level }: { level: number }) {
  const { theme } = useReedTheme();
  const bars = [0.45, 0.8, 0.6].map(weight => 5 + Math.round(level * weight * 12));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.voiceButtonMeter}>
      {bars.map((height, index) => (
        <View
          key={`${index}-${height}`}
          style={[
            styles.voiceButtonMeterBar,
            {
              backgroundColor: theme.colors.accentInk,
              height,
              opacity: level > 0.04 ? 0.42 + (level * 0.5) : 0.22,
            },
          ]}
        />
      ))}
    </View>
  );
}

function SharedVoiceButtonMeter() {
  const level = useComposerVoiceLevel();
  return <VoiceButtonMeter level={level} />;
}
