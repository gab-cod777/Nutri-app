import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

export default function MealLayout() {
  const status = useAuthStore((state) => state.status);
  if (status !== 'signedIn') return <Redirect href="/login" />;
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="capture" options={{ title: 'Registrar refeição' }} />
      <Stack.Screen
        name="analyzing"
        options={{ title: 'Analisando', headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen name="confirm" options={{ title: 'Confirmar refeição' }} />
      <Stack.Screen name="search" options={{ title: 'Buscar alimento' }} />
    </Stack>
  );
}
