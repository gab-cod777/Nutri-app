import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

/** Telas publicas. Quem ja tem sessao vai direto para o app. */
export default function AuthLayout() {
  const status = useAuthStore((state) => state.status);
  if (status === 'signedIn') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
