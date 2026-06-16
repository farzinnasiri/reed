import { posthog } from '@/lib/posthog';
import type { Id } from '@/convex/_generated/dataModel';

type AuthMethod = 'email' | 'google';
type MessageSource = 'quick-action' | 'typed' | 'voice';
type ProductEventName =
  | 'account_signed_out'
  | 'exercise_added'
  | 'onboarding_completed'
  | 'onboarding_declined'
  | 'quick_log_submitted'
  | 'reed_message_sent'
  | 'user_signed_in'
  | 'user_signed_up'
  | 'workout_session_finished'
  | 'workout_session_started'
  | 'workout_set_logged';

const productEvents = {
  accountSignedOut: 'account_signed_out',
  exerciseAdded: 'exercise_added',
  onboardingCompleted: 'onboarding_completed',
  onboardingDeclined: 'onboarding_declined',
  quickLogSubmitted: 'quick_log_submitted',
  reedMessageSent: 'reed_message_sent',
  userSignedIn: 'user_signed_in',
  userSignedUp: 'user_signed_up',
  workoutSessionFinished: 'workout_session_finished',
  workoutSessionStarted: 'workout_session_started',
  workoutSetLogged: 'workout_set_logged',
} as const satisfies Record<string, ProductEventName>;

export const analytics = {
  identifyProfile(profile: { _id: Id<'profiles'>; onboardingCompletedAt?: number }) {
    posthog.identify(profile._id, {
      $set: {
        onboarding_completed: Boolean(profile.onboardingCompletedAt),
      },
    });
  },

  reset() {
    posthog.reset();
  },

  screen(pathname: string, previousPathname?: string) {
    posthog.screen(pathname, { previous_screen: previousPathname ?? null });
  },

  accountSignedOut() {
    captureProductEvent(productEvents.accountSignedOut);
  },

  exerciseAdded(input: { addMode?: 'single' | 'bulk'; exerciseCount?: number } = {}) {
    captureProductEvent(productEvents.exerciseAdded, {
      add_mode: input.addMode ?? 'single',
      exercise_count: input.exerciseCount ?? 1,
    });
  },

  onboardingCompleted(input: { rankedGoalCount: number }) {
    captureProductEvent(productEvents.onboardingCompleted, {
      ranked_goal_count: input.rankedGoalCount,
    });
  },

  onboardingDeclined() {
    captureProductEvent(productEvents.onboardingDeclined);
  },

  quickLogSubmitted(input: { exerciseGroup: string; inputKind: string }) {
    captureProductEvent(productEvents.quickLogSubmitted, {
      exercise_group: input.exerciseGroup,
      input_kind: input.inputKind,
    });
  },

  reedMessageSent(input: { hasAttachments: boolean; source: MessageSource }) {
    captureProductEvent(productEvents.reedMessageSent, {
      has_attachments: input.hasAttachments,
      source: input.source,
    });
  },

  userSignedIn(input: { method: AuthMethod }) {
    captureProductEvent(productEvents.userSignedIn, { method: input.method });
  },

  userSignedUp() {
    captureProductEvent(productEvents.userSignedUp);
  },

  workoutSessionFinished(input: { exerciseCount: number; totalSets: number }) {
    captureProductEvent(productEvents.workoutSessionFinished, {
      exercise_count: input.exerciseCount,
      total_sets: input.totalSets,
    });
  },

  workoutSessionStarted() {
    captureProductEvent(productEvents.workoutSessionStarted);
  },

  workoutSetLogged(input: { setNumber: number; warmup: boolean }) {
    captureProductEvent(productEvents.workoutSetLogged, {
      set_number: input.setNumber,
      warmup: input.warmup,
    });
  },
};

function captureProductEvent(name: ProductEventName, properties?: Record<string, string | number | boolean>) {
  posthog.capture(name, {
    event_kind: 'product',
    ...properties,
  });
  void posthog.flush().catch(() => {});
}
