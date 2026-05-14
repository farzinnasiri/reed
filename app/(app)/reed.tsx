import { ReedSurface } from '@/components/reed/reed-surface';
import { useAppShell } from '@/components/home/app-shell-context';

export default function ReedRoute() {
  const { displayName, dockReservedSpace } = useAppShell();

  return <ReedSurface displayName={displayName} dockReservedSpace={dockReservedSpace} />;
}
