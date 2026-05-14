import { ProfileSurface } from '@/components/home/profile-surface';
import { useAppShell } from '@/components/home/app-shell-context';

export default function ProfileRoute() {
  const { displayName, setIsEditingSettingsProfile } = useAppShell();

  return (
    <ProfileSurface
      displayName={displayName}
      onEditingProfileChange={setIsEditingSettingsProfile}
    />
  );
}
