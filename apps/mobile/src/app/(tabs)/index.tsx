import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CalorieRing } from '@/components/ui/calorie-ring';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { MacroBar } from '@/components/ui/macro-bar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { MEAL_TYPE_LABELS } from '@/lib/labels';
import { isNotFound } from '@/services/api/errors';
import { useDiario, usePerfil, useResumo, useToday, useTreinoDia } from '@/services/api/queries';

/** Inicio: tudo vem da API (perfil, resumo do dia, treino do dia, diario). */
export default function HomeScreen() {
  const today = useToday();
  const perfil = usePerfil();
  const resumo = useResumo(today);
  const diario = useDiario(today);
  const treino = useTreinoDia();

  const recentMeals = (diario.data?.items ?? []).slice(0, 3);

  return (
    <Screen>
      <Logo size={28} />

      <View>
        <ThemedText type="small" themeColor="textSecondary">
          Olá,
        </ThemedText>
        <ThemedText type="subtitle">{perfil.data?.profile?.displayName ?? ''}</ThemedText>
      </View>

      {resumo.isPending ? (
        <LoadingBlock label="Carregando seu dia..." />
      ) : resumo.isError ? (
        <ErrorBlock error={resumo.error} onRetry={() => void resumo.refetch()} />
      ) : (
        <>
          <Card style={styles.ringCard}>
            <CalorieRing consumed={resumo.data.calories.consumed} target={resumo.data.calories.target} />
          </Card>
          <Card>
            <MacroBar label="Proteína" consumed={resumo.data.protein.consumed} target={resumo.data.protein.target} color="protein" />
            <MacroBar label="Carboidrato" consumed={resumo.data.carbs.consumed} target={resumo.data.carbs.target} color="carbs" />
            <MacroBar label="Gordura" consumed={resumo.data.fat.consumed} target={resumo.data.fat.target} color="fat" />
          </Card>
        </>
      )}

      <Card>
        <ThemedText type="smallBold">Treino de hoje</ThemedText>
        {treino.isPending ? (
          <ThemedText themeColor="textSecondary">Carregando...</ThemedText>
        ) : treino.isError ? (
          <ThemedText themeColor="textSecondary">
            {isNotFound(treino.error) ? 'Você ainda não tem plano de treino. Gere na aba Treino.' : 'Não foi possível carregar o treino.'}
          </ThemedText>
        ) : treino.data.isRestDay ? (
          <ThemedText themeColor="textSecondary">
            Hoje é dia de descanso.
            {treino.data.nextWorkout ? ` Próximo: ${treino.data.nextWorkout.name}.` : ''}
          </ThemedText>
        ) : (
          <ThemedText type="link" themeColor="primary" onPress={() => router.navigate('/(tabs)/workout')}>
            {treino.data.workout?.name} · {treino.data.workout?.exercises.length} exercícios
          </ThemedText>
        )}
      </Card>

      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">Últimas refeições</ThemedText>
        <ThemedText type="link" themeColor="primary" onPress={() => router.navigate('/(tabs)/diary')}>
          Ver diário
        </ThemedText>
      </View>

      {diario.isError ? (
        <ErrorBlock error={diario.error} onRetry={() => void diario.refetch()} />
      ) : recentMeals.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            Nenhuma refeição registrada hoje. Toque no botão da câmera para começar.
          </ThemedText>
        </Card>
      ) : (
        recentMeals.map((meal) => (
          <Card key={meal.id} style={styles.mealRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">{meal.title ?? MEAL_TYPE_LABELS[meal.mealType]}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {MEAL_TYPE_LABELS[meal.mealType]} · {meal.foods.length} itens
              </ThemedText>
            </View>
            <ThemedText type="smallBold">{Math.round(meal.totals.calories)} kcal</ThemedText>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ringCard: { alignItems: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  mealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
