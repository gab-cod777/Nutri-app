import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBlock, LoadingBlock } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { useTheme } from '@/hooks/use-theme';
import { usePerfil } from '@/services/api/queries';
import { useAuthStore } from '@/store/auth-store';

const TAB_BAR_HEIGHT = 58;

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((state) => state.status);
  // GET /perfil valida a sessao (401 -> volta ao login) e diz se o onboarding foi feito.
  const perfil = usePerfil();

  if (status !== 'signedIn') return <Redirect href="/login" />;
  if (perfil.isPending) {
    return (
      <Screen withTabBarInset={false}>
        <LoadingBlock label="Conectando ao servidor..." />
      </Screen>
    );
  }
  if (perfil.isError) {
    // Sem rede nao desloga: o token continua salvo e o usuario tenta de novo.
    return (
      <Screen withTabBarInset={false}>
        <ErrorBlock error={perfil.error} onRetry={() => void perfil.refetch()} />
      </Screen>
    );
  }
  if (!perfil.data.onboarding.completed) return <Redirect href="/onboarding" />;

  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            height: tabBarHeight,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11 },
        }}>
        <Tabs.Screen
          name="index"
          options={{ title: 'Início', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="diary"
          options={{
            title: 'Diário',
            tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plano',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="workout"
          options={{
            title: 'Treino',
            tabBarIcon: ({ color, size }) => <Ionicons name="barbell" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
          }}
        />
      </Tabs>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Registrar refeição"
        onPress={() => router.push('/meal/capture')}
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            bottom: tabBarHeight + 14,
          },
        ]}>
        <Ionicons name="camera" color={theme.primaryText} size={26} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
});
