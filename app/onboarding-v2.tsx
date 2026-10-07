import { Redirect } from 'expo-router';

/** Existing preview bookmarks lead to the authenticated onboarding entry. */
export default function OnboardingEntry() { return <Redirect href="/" />; }
