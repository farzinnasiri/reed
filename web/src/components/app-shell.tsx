'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { LoopMark } from './loop-mark';
import { WebOnboarding } from './web-onboarding';

const navigation = [
  { href: '/app', label: 'Overview' },
  { href: '/app/chat', label: 'Reed' },
  { href: '/app/training', label: 'Training' },
  { href: '/app/goals', label: 'Goals' },
  { href: '/app/profile', label: 'Profile' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand"><LoopMark size="small" /><span className="wordmark">REED</span></div>
        <nav className="app-nav" aria-label="Main navigation">
          {navigation.map(item => (
            <Link className={pathname === item.href ? 'nav-link nav-link-active' : 'nav-link'} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-account">
          <UserButton />
          <div><strong>{user?.fullName ?? 'Your account'}</strong><span>{user?.primaryEmailAddress?.emailAddress}</span></div>
        </div>
      </aside>
      <main className="app-main"><ProfileGate>{children}</ProfileGate></main>
    </div>
  );
}

function ProfileGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : 'skip');
  const ensureViewerProfile = useMutation(api.profiles.ensureViewerProfile);

  useEffect(() => {
    if (isAuthenticated && viewer === null) void ensureViewerProfile({});
  }, [ensureViewerProfile, isAuthenticated, viewer]);

  if (isLoading || viewer === undefined || viewer === null) {
    return <div className="page-loading"><LoopMark expression="thinking" /><p>Connecting your Reed account…</p></div>;
  }

  if (!viewer.onboardingCompletedAt) return <WebOnboarding />;
  return children;
}
