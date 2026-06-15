import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedEasing, reedMotion, shouldUseNativeDriver } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { styles } from './reed.styles';
import type { ReedDraftAttachment, ReedQuickAction, VoiceComposerState } from './reed.types';

const COMPOSER_INPUT_MIN_HEIGHT = 22;
const COMPOSER_INPUT_MAX_HEIGHT = 96;

export function ReedComposer({
  attachments,
  canAttachMore,
  composerText,
  disabled,
  isPreparingAttachments,
  lastAttachmentError,
  onChangeComposerText,
  onPickCamera,
  onPickFiles,
  onPickLibrary,
  onQuickAction,
  onRemoveAttachment,
  onRetryVoice,
  onSendTyped,
  onSendVoiceDraft,
  onStartVoice,
  onStopVoice,
  quickActions,
  shouldShowQuickActions,
  voiceState,
}: {
  attachments: ReedDraftAttachment[];
  canAttachMore: boolean;
  composerText: string;
  disabled: boolean;
  isPreparingAttachments: boolean;
  lastAttachmentError: string | null;
  onChangeComposerText: (text: string) => void;
  onPickCamera: () => void;
  onPickFiles: () => void;
  onPickLibrary: () => void;
  onQuickAction: (prompt: string) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onRetryVoice: () => void;
  onSendTyped: (text: string) => void;
  onSendVoiceDraft: (text: string) => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  quickActions: ReedQuickAction[];
  shouldShowQuickActions: boolean;
  voiceState: VoiceComposerState;
}) {
  return (
    <>
      {shouldShowQuickActions ? (
        <ScrollView
          contentContainerStyle={styles.quickActionsContent}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.quickActionsScroller}
        >
          {quickActions.map(action => (
            <QuickActionChip
              disabled={disabled}
              key={action.id}
              label={action.label}
              onPress={() => onQuickAction(action.prompt)}
            />
          ))}
        </ScrollView>
      ) : null}

      <ComposerCard
        attachments={attachments}
        canAttachMore={canAttachMore}
        disabled={disabled}
        isPreparingAttachments={isPreparingAttachments}
        lastAttachmentError={lastAttachmentError}
        onCancelVoice={onStopVoice}
        onChangeText={onChangeComposerText}
        onPickCamera={onPickCamera}
        onPickFiles={onPickFiles}
        onPickLibrary={onPickLibrary}
        onRemoveAttachment={onRemoveAttachment}
        onRetryVoice={onRetryVoice}
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
        {
          backgroundColor: theme.colors.controlFill,
          borderColor: theme.colors.controlBorder,
        },
        getTapScaleStyle(pressed, disabled),
      ]}
    >
      <ReedText variant="caption">{label}</ReedText>
    </Pressable>
  );
}

function ComposerCard({
  attachments,
  canAttachMore,
  disabled,
  isPreparingAttachments,
  lastAttachmentError,
  onCancelVoice,
  onChangeText,
  onPickCamera,
  onPickFiles,
  onPickLibrary,
  onRemoveAttachment,
  onRetryVoice,
  onSend,
  onVoice,
  text,
  voiceState,
}: {
  attachments: ReedDraftAttachment[];
  canAttachMore: boolean;
  disabled: boolean;
  isPreparingAttachments: boolean;
  lastAttachmentError: string | null;
  onCancelVoice: () => void;
  onChangeText: (text: string) => void;
  onPickCamera: () => void;
  onPickFiles: () => void;
  onPickLibrary: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onRetryVoice: () => void;
  onSend: () => void;
  onVoice: () => void;
  text: string;
  voiceState: VoiceComposerState;
}) {
  const { theme } = useReedTheme();
  const [inputContentHeight, setInputContentHeight] = useState(22);
  const [isAttachmentPickerOpen, setIsAttachmentPickerOpen] = useState(false);
  const attachmentPickerProgress = useRef(new Animated.Value(0)).current;
  const isVoiceActive = voiceState.status !== 'idle';
  const isVoiceBusy = voiceState.status === 'listening' || voiceState.status === 'transcribing';
  const shouldShowVoiceStatus = voiceState.status === 'transcribing' || voiceState.status === 'failed';
  const draftText = shouldShowVoiceStatus ? voiceState.transcript : text;
  const hasReadyAttachments = attachments.some(attachment => attachment.status === 'ready');
  const canSend = (!isVoiceActive && (text.trim().length > 0 || hasReadyAttachments)) && !disabled && !isPreparingAttachments;
  const inputHeight = Math.min(COMPOSER_INPUT_MAX_HEIGHT, Math.max(COMPOSER_INPUT_MIN_HEIGHT, Math.ceil(inputContentHeight)));

  useEffect(() => {
    if (draftText.length === 0) {
      setInputContentHeight(COMPOSER_INPUT_MIN_HEIGHT);
    }
  }, [draftText.length]);

  useEffect(() => {
    createTiming(
      attachmentPickerProgress,
      isAttachmentPickerOpen ? 1 : 0,
      reedMotion.durations.mode,
      reedEasing.easeOut,
      shouldUseNativeDriver,
    ).start();
  }, [attachmentPickerProgress, isAttachmentPickerOpen]);

  useEffect(() => {
    if (!canAttachMore) {
      setIsAttachmentPickerOpen(false);
    }
  }, [canAttachMore]);

  const attachmentPickerStyle = {
    opacity: attachmentPickerProgress,
    transform: [{
      translateY: attachmentPickerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [8, 0],
      }),
    }],
  };

  return (
    <GlassSurface contentStyle={styles.composerCardContent} style={styles.composerCard}>
      {attachments.length > 0 || lastAttachmentError ? (
        <AttachmentTray
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
        />
      ) : null}

      {isAttachmentPickerOpen && canAttachMore ? (
        <Animated.View style={[styles.attachmentPickerPopover, attachmentPickerStyle]}>
          <AttachmentActions
            disabled={disabled || isVoiceActive}
            onPickCamera={() => {
              setIsAttachmentPickerOpen(false);
              onPickCamera();
            }}
            onPickFiles={() => {
              setIsAttachmentPickerOpen(false);
              onPickFiles();
            }}
            onPickLibrary={() => {
              setIsAttachmentPickerOpen(false);
              onPickLibrary();
            }}
          />
        </Animated.View>
      ) : null}

      <View style={styles.composerInputRow}>
        <View style={[styles.composerInputFrame, { height: shouldShowVoiceStatus ? 44 : Math.max(44, inputHeight) }]}>
          {shouldShowVoiceStatus ? (
            <View style={styles.voiceStatusInline}>
              <ReedText
                numberOfLines={1}
                tone={voiceState.status === 'failed' ? 'danger' : 'muted'}
                variant="caption"
              >
                {voiceState.status === 'failed' ? voiceState.error ?? 'Could not transcribe audio.' : 'Transcribing voice...'}
              </ReedText>
            </View>
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
                  setInputContentHeight(COMPOSER_INPUT_MIN_HEIGHT);
                }
                onChangeText(nextText);
              }}
              onContentSizeChange={event => {
                setInputContentHeight(event.nativeEvent.contentSize.height);
              }}
              placeholder={disabled ? 'Reed is thinking' : 'Message Reed'}
              placeholderTextColor={String(theme.colors.textMuted)}
              scrollEnabled={inputContentHeight > COMPOSER_INPUT_MAX_HEIGHT}
              style={[
                styles.composerInput,
                {
                  color: String(theme.colors.textPrimary),
                  fontFamily: theme.typography.body.fontFamily,
                  height: inputHeight,
                },
              ]}
              value={draftText}
            />
          )}
        </View>

        <View style={styles.composerButtonCluster}>
          <Pressable
            accessibilityHint="Opens photo attachment options."
            accessibilityLabel="Attach image"
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || isVoiceActive || !canAttachMore, expanded: isAttachmentPickerOpen }}
            disabled={disabled || isVoiceActive || !canAttachMore}
            onPress={() => setIsAttachmentPickerOpen(current => !current)}
            style={({ pressed }) => [
              styles.composerIconButton,
              { backgroundColor: isAttachmentPickerOpen ? theme.colors.controlFill : 'transparent' },
              getTapScaleStyle(pressed, disabled || isVoiceActive || !canAttachMore),
            ]}
          >
            <Ionicons
              color={String(disabled || isVoiceActive || !canAttachMore ? theme.colors.textMuted : theme.colors.textPrimary)}
              name={isAttachmentPickerOpen ? 'close' : 'add'}
              size={20}
            />
          </Pressable>

          <Pressable
            accessibilityHint={voiceState.status === 'failed' ? 'Retries the last voice transcription.' : isVoiceActive ? 'Stops voice input.' : 'Starts voice input.'}
            accessibilityLabel={voiceState.status === 'failed' ? 'Retry voice transcription' : isVoiceActive ? 'Stop voice mode' : 'Start voice mode'}
            accessibilityRole="button"
            accessibilityState={{ busy: isVoiceBusy, disabled: disabled || voiceState.status === 'transcribing' }}
            disabled={disabled || voiceState.status === 'transcribing'}
            onPress={voiceState.status === 'failed' ? onRetryVoice : isVoiceActive ? onCancelVoice : onVoice}
            style={({ pressed }) => [
              styles.composerIconButton,
              voiceState.status === 'listening' ? styles.composerVoiceButtonActive : null,
              { backgroundColor: isVoiceActive ? theme.colors.controlFill : 'transparent' },
              getTapScaleStyle(pressed, disabled || voiceState.status === 'transcribing'),
            ]}
          >
            <View style={styles.voiceButtonContent}>
              <Ionicons
                color={String(voiceState.status === 'failed' ? theme.colors.dangerText : theme.colors.textPrimary)}
                name={voiceState.status === 'failed' ? 'refresh' : isVoiceActive ? 'stop' : 'mic-outline'}
                size={18}
              />
              {voiceState.status === 'listening' ? (
                <VoiceButtonMeter level={voiceState.voiceLevel} />
              ) : null}
            </View>
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

function AttachmentActions({
  disabled,
  onPickCamera,
  onPickFiles,
  onPickLibrary,
}: {
  disabled: boolean;
  onPickCamera: () => void;
  onPickFiles: () => void;
  onPickLibrary: () => void;
}) {
  return (
    <View style={styles.attachmentActionsRow}>
      <ComposerIconButton
        accessibilityLabel="Take photo"
        disabled={disabled}
        icon="camera-outline"
        onPress={onPickCamera}
      />
      <ComposerIconButton
        accessibilityHint="Press for your photo library. Long press to choose image files."
        accessibilityLabel="Choose images"
        disabled={disabled}
        icon="images-outline"
        onLongPress={onPickFiles}
        onPress={onPickLibrary}
      />
    </View>
  );
}

function ComposerIconButton({
  accessibilityLabel,
  accessibilityHint,
  disabled,
  icon,
  onLongPress,
  onPress,
}: {
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled: boolean;
  icon: ComponentProps<typeof Ionicons>['name'];
  onLongPress?: () => void;
  onPress: () => void;
}) {
  const { theme } = useReedTheme();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.composerIconButton,
        getTapScaleStyle(pressed, disabled),
      ]}
    >
      <Ionicons color={String(disabled ? theme.colors.textMuted : theme.colors.textPrimary)} name={icon} size={18} />
    </Pressable>
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
                backgroundColor: theme.colors.controlFill,
                borderColor: attachment.status === 'failed' ? theme.colors.dangerBorder : theme.colors.controlBorder,
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
                  color={String(theme.colors.accentPrimaryText)}
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
              <Ionicons color={String(theme.colors.textPrimary)} name="close" size={13} />
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
              backgroundColor: theme.colors.accentPrimary,
              height,
              opacity: level > 0.04 ? 0.42 + (level * 0.5) : 0.22,
            },
          ]}
        />
      ))}
    </View>
  );
}
