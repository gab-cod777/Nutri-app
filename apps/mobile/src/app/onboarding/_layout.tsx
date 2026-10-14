import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

export default function OnboardingLayout() {
  const status = useAuthStore((state) => state.status);
  if (status !== 'signedIn') return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
