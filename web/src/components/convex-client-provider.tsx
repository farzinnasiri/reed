'use client';

import { useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useMemo, type ReactNode } from 'react';

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(() => url ? new ConvexReactClient(url) : null, [url]);

  if (!client) {
    return <main className="config-error"><h1>Reed web is not configured.</h1><p>Add NEXT_PUBLIC_CONVEX_URL, then restart the server.</p></main>;
  }

  return <ConvexProviderWithClerk client={client} useAuth={useAuth}>{children}</ConvexProviderWithClerk>;
}
