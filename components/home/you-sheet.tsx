import { useClerk, useUser } from '@clerk/expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetScrollView, type BottomSheetModal } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { draftFromOnboarding } from '@/components/onboarding/persistence';
import type { Draft } from '@/components/onboarding/draft';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedText } from '@/components/ui/reed-text';
import { ReedToggle } from '@/components/ui/reed-toggle';
import { getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedAccentPalettes, reedProfileMetrics as metrics } from '@/design/system';
import type { ProfileChange } from '@/domains/profile/edits';
import { analytics } from '@/lib/analytics';
import { usePushDevice } from '@/lib/push-device-provider';
import { appViewRoutes } from './app-routes';
import { useAppShell } from './app-shell-context';
import { AccentPreferences } from './accent-preferences';
import { ProfileFacts } from './profile-facts';
import { ProfileDetails } from './profile/profile-details';
import { ProfileEditor, profileEditorTitle } from './profile/profile-editor';
import { ProfileRow } from './profile/profile-row';
import type { ProfileEditorId, ProfileSection } from './profile/profile-contract';

type YouSheetProps = { onClose: () => void; visible: boolean };
const titles: Record<ProfileSection, string> = { body: 'Body', practices: 'Practices & priorities', training: 'Coaching & week', preferences: 'Preferences', account: 'Account' };

/** One sheet, with a compact menu, section views and focused answer editors. */
export function YouSheet({ onClose, visible }: YouSheetProps) {
  const { theme, accentChoice, automaticAccent, setAutomaticAccent } = useReedTheme();
  const { displayName } = useAppShell();
  const { signOut } = useClerk();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const data = useQuery(api.profiles.viewerTrainingProfile, {});
  const notificationPreferences = useQuery(api.notificationPreferences.viewerPreferences, {});
  const notificationDeviceStatus = useQuery(api.notificationDevices.viewerStatus, {});
  const pushDevice = usePushDevice();
  const updateNotifications = useMutation(api.notificationPreferences.updatePreferences);
  const updateField = useMutation(api.onboarding.updateField);
  const deleteViewerData = useMutation(api.profiles.deleteViewerData);
  const [section, setSection] = useState<ProfileSection | 'overview'>('overview');
  const [practiceTab, setPracticeTab] = useState<'practices' | 'priorities'>('practices');
  const [editor, setEditor] = useState<{ id: ProfileEditorId; draft: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const isOverview = section === 'overview' && !editor;
  const editDraft = useMemo(() => {
    if (!data?.trainingProfile.onboarding) return null;
    const draft = draftFromOnboarding(data.trainingProfile.onboarding, displayName);
    const weight = data.latestBodyMetrics.find(metric => metric.metricKey === 'body_weight');
    return { ...draft, weightKg: weight?.value ?? draft.weightKg };
  }, [data, displayName]);

  const goBack = useCallback(() => {
    if (isWorking) return;
    if (editor) { if (editor.id === 'sex') setAutomaticAccent(editor.draft.sex); setEditor(null); }
    else if (confirmDelete) setConfirmDelete(false);
    else if (section !== 'overview') { setSection('overview'); setError(null); }
    else sheetRef.current?.dismiss();
  }, [confirmDelete, editor, isWorking, section, setAutomaticAccent]);

  function handleDismiss() {
    if (editor?.id === 'sex') setAutomaticAccent(editor.draft.sex);
    setEditor(null);
    setSection('overview');
    setPracticeTab('practices');
    setConfirmDelete(false);
    setError(null);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    onClose();
    action?.();
  }
  function open(section: ProfileSection) { setError(null); setSection(section); }
  function edit(id: ProfileEditorId) { if (editDraft) { setError(null); setEditor({ id, draft: editDraft }); } }
  function openGoals() { pendingActionRef.current = () => router.push(appViewRoutes.goals); sheetRef.current?.dismiss(); }
  async function save(change: ProfileChange) {
    setIsWorking(true);
    try { await updateField({ change }); setEditor(null); }
    finally { setIsWorking(false); }
  }
  async function runAction(action: () => Promise<void>) {
    if (isWorking) return;
    setIsWorking(true);
    setError(null);
    try { await action(); }
    catch (failure) { setError(getErrorMessage(failure)); }
    finally { setIsWorking(false); }
  }
  function handleSignOut() {
    void runAction(async () => { await pushDevice.disable('logout'); await signOut(); analytics.accountSignedOut(); analytics.reset(); });
  }
  function handleDeleteAccount() {
    void runAction(async () => {
      if (!user) throw new Error('Your account is still loading.');
      await deleteViewerData({});
      await user.delete();
      analytics.reset();
    });
  }
  function handleNotificationToggle(enabled: boolean) {
    void runAction(async () => {
      await updateNotifications({ enabled });
      if (!enabled) { await pushDevice.disable('user_disabled'); return; }
      const status = await pushDevice.enable();
      if (status !== 'registered') throw new Error(notificationRegistrationMessage(status ?? 'failed'));
    });
  }

  function pane(content: ReactNode, footer?: ReactNode) {
    // New content fades in over a sheet that stays the same height: moving between the overview,
    // a section and an editor changes what is shown, never the sheet's size.
    return <Animated.View key={`pane-${editor ? `editor-${editor.id}` : section}`} entering={FadeIn.duration(reedMotion.durations.standard)} style={{ flex: 1, minHeight: 0 }}>
      <BottomSheetScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onLayout={event => setBodyHeight(Math.max(0, event.nativeEvent.layout.height - theme.spacing.md * 2))} contentContainerStyle={{ paddingHorizontal: theme.spacing.gutter, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        {content}
      </BottomSheetScrollView>
      {footer ? <View style={{ paddingTop: theme.spacing.sm, paddingHorizontal: theme.spacing.gutter, paddingBottom: insets.bottom + theme.spacing.md }}>{footer}</View> : null}
    </Animated.View>;
  }
  const overview = <View style={{ gap: theme.spacing.sm }}>
    {data === undefined ? <View style={{ flexDirection: 'row', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}><ActivityIndicator color={String(theme.colors.accent)} /><ReedText tone="secondary">Loading profile.</ReedText></View>
      : data?.trainingProfile.onboarding ? <ProfileFacts profileData={data} onOpen={open} /> : <ReedText tone="secondary">Your training profile is unavailable. Close this sheet and try again.</ReedText>}
    <View style={{ marginTop: theme.spacing.sm }}>
      <ProfileRow title="Preferences" icon="options-outline" detail={`${reedAccentPalettes[accentChoice === 'automatic' ? automaticAccent : accentChoice].label} · Coach updates`} onPress={() => open('preferences')} />
      <ProfileRow title="Account" icon="person-outline" detail="Name, sign out and account controls" onPress={() => open('account')} />
    </View>
  </View>;
  const preferences = <View style={{ gap: theme.spacing.xl }}>
    <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center', minHeight: metrics.metricHeight }}>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}><ReedText variant="bodyStrong">Coach updates</ReedText><ReedText tone="secondary" variant="caption">{Platform.OS === 'web' ? 'Available in the mobile app.' : notificationStatusText(notificationPreferences, notificationDeviceStatus)}</ReedText></View>
      <ReedToggle accessibilityLabel="Coach updates" disabled={Platform.OS === 'web' || isWorking || notificationPreferences === undefined || notificationDeviceStatus === undefined} onValueChange={handleNotificationToggle} value={Boolean(notificationPreferences?.enabled && notificationDeviceStatus?.hasEnabledDevice)} />
    </View>
    <AccentPreferences />
  </View>;
  const account = confirmDelete ? <View style={{ gap: theme.spacing.lg }}>
    <ReedText variant="headline">Delete your account?</ReedText><ReedText tone="secondary">This permanently removes your account and training data. Clerk may ask you to verify again first.</ReedText>
    <ReedButton label="Keep my account" variant="secondary" onPress={() => setConfirmDelete(false)} disabled={isWorking} />
    <Pressable accessibilityRole="button" accessibilityLabel="Confirm delete account" disabled={isWorking} onPress={handleDeleteAccount} style={({ pressed }) => [{ minHeight: metrics.hit, alignItems: 'center', justifyContent: 'center' }, getTapScaleStyle(pressed, isWorking)]}><ReedText tone="danger" variant="bodyStrong">{isWorking ? 'Deleting…' : 'Delete account permanently'}</ReedText></Pressable>
  </View> : <View style={{ gap: theme.spacing.lg }}>
    <ProfileRow title="Your name" value={displayName} onPress={() => edit('name')} />
    <View style={{ gap: theme.spacing.xxs }}><ReedText tone="muted" variant="caption">Email</ReedText><ReedText variant="body">{user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}</ReedText></View>
    <ReedButton label={isWorking ? 'Signing out…' : 'Sign out'} variant="secondary" disabled={isWorking} onPress={handleSignOut} />
    <Pressable accessibilityRole="button" disabled={isWorking} onPress={() => setConfirmDelete(true)} style={({ pressed }) => [{ minHeight: metrics.hit, justifyContent: 'center' }, getTapScaleStyle(pressed, isWorking)]}><ReedText tone="danger">Delete account</ReedText></Pressable>
  </View>;

  return <ReedSheet open={visible} ref={sheetRef} onDismiss={handleDismiss} onBack={goBack} heightFraction={metrics.detailFraction}>
    <View style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: metrics.maxWidth, alignSelf: 'center' }}>
      <Animated.View key={`header-${editor ? `editor-${editor.id}` : section}`} entering={FadeIn.duration(reedMotion.durations.standard)} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.gutter, paddingVertical: theme.spacing.sm }}>
        {isOverview ? <>
          {user?.hasImage ? (
            <Image accessibilityIgnoresInvertColors source={{ uri: user.imageUrl }} style={{ width: metrics.avatar, height: metrics.avatar, borderRadius: theme.radii.pill }} />
          ) : (
            <View style={{ width: metrics.avatar, height: metrics.avatar, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}><ReedText variant="title">{Array.from(displayName.trim())[0]?.toUpperCase() ?? 'Y'}</ReedText></View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}><ReedText numberOfLines={1} variant="title">{displayName}</ReedText><ReedText numberOfLines={1} tone="secondary" variant="caption">{user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}</ReedText></View>
        </> : <>
          {editor ? <Pressable accessibilityRole="button" accessibilityLabel="Cancel editing" disabled={isWorking} onPress={goBack} style={({ pressed }) => [{ minHeight: metrics.hit, justifyContent: 'center', paddingRight: theme.spacing.xs }, getTapScaleStyle(pressed)]}><ReedText tone="secondary" variant="body">Cancel</ReedText></Pressable> : <ReedIconButton accessibilityLabel="Back to profile" variant="ghost" disabled={isWorking} onPress={goBack}><Ionicons name="chevron-back" color={String(theme.colors.inkSecondary)} size={22} /></ReedIconButton>}
          <ReedText numberOfLines={1} variant="headline" style={{ flex: 1 }}>{editor ? profileEditorTitle(editor.id) : titles[section as ProfileSection]}</ReedText>
        </>}
        <ReedIconButton accessibilityLabel="Close profile" variant="ghost" disabled={isWorking} onPress={() => sheetRef.current?.dismiss()}><Ionicons name="close" color={String(theme.colors.inkSecondary)} size={22} /></ReedIconButton>
      </Animated.View>
      {editor ? <ProfileEditor key={editor.id} editor={editor.id} initialDraft={editor.draft} bodyHeight={bodyHeight} onSave={save} render={pane} />
        : pane(<>
          {isOverview ? overview : section === 'preferences' ? preferences : section === 'account' ? account : data ? <ProfileDetails section={section as ProfileSection} data={data} onEdit={edit} onGoals={openGoals} practiceTab={practiceTab} onPracticeTab={setPracticeTab} /> : null}
          {error ? <ReedText accessibilityLiveRegion="polite" tone="danger" style={{ marginTop: theme.spacing.md }}>{error}</ReedText> : null}
        </>)}
    </View>
  </ReedSheet>;
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: string; message?: string; statusText?: string };
    if (candidate.code === 'SESSION_EXPIRED') return 'This action needs a fresh login. Sign in again, then retry.';
    return candidate.message ?? candidate.statusText ?? 'Could not update your account. Try again.';
  }
  return 'Could not update your account. Try again.';
}
function notificationStatusText(preferences: { enabled: boolean } | null | undefined, deviceStatus: { hasEnabledDevice: boolean; latestDevice: { disableReason?: string } | null } | undefined) {
  if (preferences === undefined || deviceStatus === undefined) return 'Checking this phone.';
  if (!preferences?.enabled) return 'Off for this account.';
  if (deviceStatus.hasEnabledDevice) return 'On for this phone.';
  if (deviceStatus.latestDevice?.disableReason === 'permission_denied') return 'Permission is off on this phone.';
  if (deviceStatus.latestDevice?.disableReason === 'user_disabled') return 'Off on this phone.';
  return 'Not set up on this phone.';
}
function notificationRegistrationMessage(status: string) {
  if (status === 'permission_denied') return 'Notifications are blocked for Reed. Enable them in Android settings, then try again.';
  if (status === 'missing_project_id') return 'This build is missing its Expo project id.';
  if (status === 'unavailable_platform' || status === 'unavailable_web') return 'Push notifications are not available on this platform.';
  return 'Reed could not register this phone for push notifications.';
}
