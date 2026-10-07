import { Platform, StyleSheet, type TextStyle } from 'react-native';
import { reedRadii } from '@/design/system';

export const styles = StyleSheet.create({
  stage: {
    flex: 1,
    // The stage recedes toward its upper middle when the Pulse or a sheet opens.
    transformOrigin: '50% 30%',
  },
  threadViewport: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  topChrome: {
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  threadBottomFade: {
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    zIndex: 11,
  },
  presenceRow: {
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    zIndex: 12,
  },
  todayLayer: {
    zIndex: 6,
  },
  dock: {
    left: 0,
    paddingTop: 6,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  dockComposer: {
    flex: 1,
    minWidth: 0,
  },
  dockFade: {
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
  },
  dockRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  sessionButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  sessionButtonLive: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 18,
    width: 'auto',
  },
  composerCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 6,
    overflow: 'hidden',
    paddingBottom: 7,
    paddingLeft: 6,
    paddingRight: 8,
    paddingTop: 7,
  },
  composerInputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
  },
  composerInputFrame: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  composerButtonCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  composerControl: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  composerVoiceButtonActive: {
    paddingHorizontal: 10,
    width: 62,
  },
  composerInput: {
    alignSelf: 'stretch',
    fontSize: 16,
    includeFontPadding: Platform.OS === 'android' ? false : undefined,
    lineHeight: 22,
    maxHeight: 96,
    minHeight: 22,
    // The card's outline is the focus indicator; the browser's own box would double it.
    // react-native's types only allow visible outline styles, so this web-only value is cast.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null),
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    textAlignVertical: Platform.OS === 'android' ? 'top' : undefined,
  },
  starterRow: {
    flexGrow: 0,
    marginLeft: -6,
    marginRight: -8,
  },
  starterRowContent: {
    gap: 8,
    paddingHorizontal: 8,
  },
  starterChip: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },

  root: {
    flex: 1,
    // CSS clip cannot scroll on focus, unlike hidden. RN's type does not include this web value.
    overflow: Platform.OS === 'web' ? ('clip' as 'hidden') : 'hidden',
  },
  content: {
    gap: 16,
  },
  column: {
    alignSelf: 'center',
    maxWidth: 720,
    width: '100%',
  },
  thread: {
    flexGrow: 1,
    gap: 14,
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
  threadRoot: {
    flex: 1,
  },
  threadRootHidden: {
    opacity: 0,
  },
  jumpToLatest: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  jumpToLatestRow: {
    alignItems: 'center',
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    zIndex: 12,
  },
  loadingEarlier: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: 6,
  },
  pastRow: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    flexDirection: 'row',
    gap: 10,
    height: 46,
    paddingLeft: 8,
    paddingRight: 14,
  },
  pastRowIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pastRowLabel: {
    flex: 1,
  },
  voiceToastContainer: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 35,
  },
  voiceToast: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    maxWidth: 420,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  messageCluster: {
    gap: 14,
  },
  dateIndicatorRow: {
    alignItems: 'center',
    paddingTop: 8,
  },
  messageRowLeft: {
    alignItems: 'stretch',
    width: '100%',
  },
  messageRowRight: {
    alignItems: 'flex-end',
    width: '100%',
  },
  assistantMessage: {
    gap: 12,
    position: 'relative',
  },
  coachNoteCaption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  coachNoteMark: {
    borderRadius: reedRadii.pill,
    height: 6,
    width: 6,
  },
  failedReply: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userMessageGroup: {
    alignItems: 'flex-end',
    maxWidth: '80%',
  },
  // The user bubble: 22 on three corners, 8 toward the user.
  messageBubble: {
    alignSelf: 'stretch',
    borderBottomRightRadius: 8,
    borderRadius: reedRadii.lg,
    flexShrink: 1,
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  messageAttachmentGrid: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  messageAttachmentImage: {
    borderRadius: reedRadii.sm,
    height: 86,
    width: 86,
  },
  voiceStatusInline: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: 28,
  },
  attachmentTray: {
    gap: 6,
  },
  attachmentPreviewContent: {
    gap: 8,
    paddingRight: 2,
  },
  attachmentPreview: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    height: 62,
    overflow: 'hidden',
    width: 62,
  },
  attachmentImage: {
    height: '100%',
    width: '100%',
  },
  attachmentStatusOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  attachmentRemoveButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 24,
  },
  voiceButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  voiceButtonMeter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 18,
  },
  voiceButtonMeterBar: {
    borderRadius: reedRadii.pill,
    width: 2,
  },
});
