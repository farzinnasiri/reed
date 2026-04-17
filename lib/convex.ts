import { ConvexReactClient } from 'convex/react';
import { appEnv, missingPublicEnv } from '@/lib/env';

export { missingPublicEnv } from '@/lib/env';

export const convex =
  missingPublicEnv.length === 0
    ? new ConvexReactClient(appEnv.convexUrl, {
        expectAuth: true,
        unsavedChangesWarning: false,
      })
    : null;
