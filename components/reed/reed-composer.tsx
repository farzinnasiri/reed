import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedEasing, reedMotion, shouldUseNativeDriver } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { QUICK_ACTIONS, VOICE_WAVEFORM_BARS, resolveQuickActionPrompt } from './reed.presenter';
import { styles } from './reed.styles';
import type { VoiceComposerState } from './reed.types';

export function ReedComposer({
  composerText,
  disabled,
  onChangeComposerText,
  onQuickAction,
  onSendTyped,
  onSendVoiceDraft,
  onStartVoice,
  onStopVoice,
  shouldShowQuickActions,
  voiceState,
}: {
  composerText: string;
  disabled: boolean;
  onChangeComposerText: (text: string) => void;
  onQuickAction: (prompt: string) => void;
  onSendTyped: (text: string) => void;
  onSendVoiceDraft: (text: string) => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  shouldShowQuickActions: boolean;
  voiceState: VoiceComposerState;
}) {
  return (
    <>
      {shouldShowQuickActions ? (
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map(action => (
            <QuickActionChip
              disabled={disabled}
              key={action}
              label={action}
              onPress={() => onQuickAction(resolveQuickActionPrompt(action))}
            />
          ))}
        </View>
      ) : null}

      <ComposerCard
        disabled={disabled}
        onCancelVoice={onStopVoice}
        onChangeText={onChangeComposerText}
        onSend={() => {
          if (voiceState.status === 'ready') {
            onSendVoiceDraft(voiceState.transcript);
            return;
          }
          onSendTyped(composerText);
        }}
        onVoice={onStartVoice}
        text={composerText}
        voiceState={voiceState}
      />
    </>
  );
}

function QuickActionChip({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useReedTheme();

  return (
    <Pressable
      accessibilityHint="Sends this suggested prompt to Reed."
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionChip,
        { borderColor: theme.colors.controlBorder },
        getTapScaleStyle(pressed, disabled),
      ]}
    >
      <ReedText variant="caption">{label}</ReedText>
    </Pressable>
  );
}

function ComposerCard({
  disabled,
  onCancelVoice,
  onChangeText,
  onSend,
  onVoice,
  text,
  voiceState,
}: {
  disabled: boolean;
  onCancelVoice: () => void;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onVoice: () => void;
  text: string;
  voiceState: VoiceComposerState;
}) {
  const { theme } = useReedTheme();
  const [inputContentHeight, setInputContentHeight] = useState(22);
  const isVoiceActive = voiceState.status !== 'idle';
  const draftText = isVoiceActive ? voiceState.transcript : text;
  const canSend = (isVoiceActive ? voiceState.status === 'ready' && voiceState.transcript.trim().length > 0 : text.trim().length > 0) && !disabled;
  const inputHeight = Math.min(96, Math.max(22, Math.ceil(inputContentHeight)));

  useEffect(() => {
    if (draftText.length === 0) {
      setInputContentHeight(22);
    }
  }, [draftText.length]);

  return (
    <GlassSurface contentStyle={styles.composerCardContent} style={styles.composerCard}>
      <View style={styles.composerInputRow}>
        <View style={[styles.composerInputFrame, { height: isVoiceActive ? 44 : Math.max(44, inputHeight) }]}> 
          {voiceState.status === 'listening' ? (
            <VoiceComposerWaveform />
          ) : (
            <TextInput
              accessibilityHint={
                isVoiceActive
                  ? 'Voice draft is active. Use the stop button to return to typing.'
                  : 'Type a question about training, recovery, or your next session.'
              }
              accessibilityLabel="Message Reed"
              accessibilityState={{ disabled: disabled || isVoiceActive, busy: disabled }}
              editable={!disabled && !isVoiceActive}
              multiline
              numberOfLines={1}
              onChangeText={nextText => {
                if (nextText.length === 0) {
                  setInputContentHeight(22);
                }
                onChangeText(nextText);
              }}
              onContentSizeChange={event => {
                setInputContentHeight(event.nativeEvent.contentSize.height);
              }}
              placeholder={disabled ? 'Reed is thinking' : 'Message Reed'}
              placeholderTextColor={String(theme.colors.textMuted)}
              scrollEnabled={false}
              style={[
                styles.composerInput,
                {
                  color: String(theme.colors.textPrimary),
                  fontFamily: theme.typography.body.fontFamily,
                  height: isVoiceActive ? 22 : inputHeight,
                },
              ]}
              value={draftText}
            />
          )}
        </View>

        <View style={styles.composerButtonCluster}>
          <Pressable
            accessibilityHint={isVoiceActive ? 'Stops voice input and keeps the current draft.' : 'Starts a voice input draft.'}
            accessibilityLabel={isVoiceActive ? 'Stop voice mode' : 'Start voice mode'}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={isVoiceActive ? onCancelVoice : onVoice}
            style={({ pressed }) => [
              styles.composerIconButton,
              { backgroundColor: isVoiceActive ? theme.colors.controlFill : 'transparent' },
              getTapScaleStyle(pressed, disabled),
            ]}
          >
            <Ionicons color={String(theme.colors.textPrimary)} name={isVoiceActive ? 'stop' : 'mic-outline'} size={18} />
          </Pressable>

          <Pressable
            accessibilityHint="Sends your message to Reed."
            accessibilityLabel="Send message"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={onSend}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: canSend ? theme.colors.accentPrimary : theme.colors.controlFill,
                borderColor: canSend ? theme.colors.accentPrimary : theme.colors.controlBorder,
                borderWidth: 1,
              },
              getTapScaleStyle(pressed, !canSend),
            ]}
          >
            <Ionicons
              color={String(canSend ? theme.colors.accentPrimaryText : theme.colors.textMuted)}
              name="arrow-up"
              size={18}
            />
          </Pressable>
        </View>
      </View>
    </GlassSurface>
  );
}

function VoiceComposerWaveform() {
  const { theme } = useReedTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        createTiming(progress, 1, reedMotion.durations.mode, reedEasing.easeInOut, shouldUseNativeDriver),
        createTiming(progress, 0, reedMotion.durations.mode, reedEasing.easeInOut, shouldUseNativeDriver),
      ]),
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [progress]);

  return (
    <View accessibilityLabel="Listening" accessibilityRole="progressbar" style={styles.voiceWaveformRow}>
      {VOICE_WAVEFORM_BARS.map((bar, index) => {
        const scaleY = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [bar.low, bar.high, bar.low],
        });

        return (
          <Animated.View
            key={`${bar.high}-${index}`}
            style={[
              styles.voiceWaveformBar,
              {
                backgroundColor: index % 3 === 1 ? theme.colors.accentPrimary : theme.colors.textMuted,
                opacity: index % 3 === 1 ? 0.92 : 0.58,
                transform: [{ scaleY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}
