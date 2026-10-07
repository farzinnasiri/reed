import { z } from 'zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { NO_RECENT_GREETINGS, pickGreeting, rememberGreeting, type Greeting, type GreetingContext, type RecentGreetings } from './greeting';

const RECENT_GREETINGS_KEY = 'reed:home:recent-greetings:v1';
// How long to wait for the week before greeting without it, e.g. offline.
const WEEK_WAIT_MS = 1500;

const recentSchema = z.object({ headers: z.array(z.string()), subs: z.array(z.string()) });

/**
 * The greeting for this opening of today mode. It is picked once, when storage has answered with
 * what was said recently and the week has arrived (or waiting for it has timed out), then held, so
 * it never changes while the screen is up. Picking it records it, so the next opening says
 * something else. `enabled` is false while a coach note leads: nothing is picked or recorded then.
 */
export function useGreeting(context: GreetingContext, seed: number, enabled: boolean): Greeting | null {
  const [recent, setRecent] = useState<RecentGreetings | undefined>(undefined);
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [gaveUpOnWeek, setGaveUpOnWeek] = useState(false);
  const weekKnown = context.week !== null;

  useEffect(() => {
    let isActive = true;
    void AsyncStorage.getItem(RECENT_GREETINGS_KEY)
      .then(value => {
        if (isActive) setRecent(value ? recentSchema.parse(JSON.parse(value)) : NO_RECENT_GREETINGS);
      })
      .catch(() => {
        if (isActive) setRecent(NO_RECENT_GREETINGS);
      });
    const timer = setTimeout(() => setGaveUpOnWeek(true), WEEK_WAIT_MS);
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, []);

  // Picked during render, the way React adjusts state to new props; held from then on.
  if (enabled && greeting === null && recent !== undefined && (weekKnown || gaveUpOnWeek)) {
    setGreeting(pickGreeting(context, seed, recent));
  }

  useEffect(() => {
    if (greeting && recent) {
      void AsyncStorage.setItem(RECENT_GREETINGS_KEY, JSON.stringify(rememberGreeting(recent, greeting))).catch(() => {});
    }
  }, [greeting, recent]);

  return greeting;
}
