import { Ionicons } from '@expo/vector-icons';
import type { Meal } from '@nutrisnap/core';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MEAL_TYPE_LABELS } from '@/lib/labels';
import { friendlyMessage } from '@/services/api/errors';
import { diarioApi } from '@/services/api/endpoints';
import { queryKeys, useDiario, useResumo, useToday } from '@/services/api/queries';
import { queryClient } from '@/services/query-client';
import { useMealDraftStore } from '@/store/meal-draft-store';

/**
 * Diario do dia: refeicoes (GET /diario) agrupadas pelos totais do resumo
 * (GET /dieta/resumo). Nenhum total e calculado aqui - so exibido.
 */
export default function DiaryScreen() {
  const theme = useTheme();
  const today = useToday();
  const resumo = useResumo(today);
  const diario = useDiario(today);
  const loadMeal = useMealDraftStore((state) => state.loadMeal);

  const remove = useMutation({
    mutationFn: (id: string) => diarioApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.diario(today) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resumo(today) });
    },
    onError: (error) => Alert.alert('Não foi possível excluir', friendlyMessage(error)),
  });

  function confirmRemove(meal: Meal) {
    Alert.alert('Excluir refeição', `Excluir "${meal.title ?? MEAL_TYPE_LABELS[meal.mealType]}" do diário?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => remove.mutate(meal.id) },
    ]);
  }

  function edit(meal: Meal) {
    loadMeal(meal);
    router.push('/meal/confirm');
  }

  if (resumo.isPending || diario.isPending) {
    return (
      <Screen>
        <ThemedText type="subtitle">Diário</ThemedText>
        <LoadingBlock />
      </Screen>
    );
  }
  if (resumo.isError || diario.isError) {
    return (
      <Screen>
        <ThemedText type="subtitle">Diário</ThemedText>
        <ErrorBlock
          error={resumo.error ?? diario.error}
          onRetry={() => {
            void resumo.refetch();
            void diario.refetch();
          }}
        />
      </Screen>
    );
  }

  const meals = diario.data.items;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Diário</ThemedText>
        <ThemedText themeColor="textSecondary">
          {resumo.data.consumed.calories} / {resumo.data.calories.target} kcal · faltam {resumo.data.calories.remaining} kcal
        </ThemedText>
      </View>

      {resumo.data.byMealType.map((bucket) => {
        const mealsOfType = meals.filter((meal) => meal.mealType === bucket.mealType);
        return (
          <Card key={bucket.mealType}>
            <View style={styles.bucketHeader}>
              <ThemedText type="smallBold">{MEAL_TYPE_LABELS[bucket.mealType]}</ThemedText>
              <View style={styles.bucketRight}>
                <ThemedText type="small" themeColor="textSecondary">
                  {bucket.totals.calories} kcal
                </ThemedText>
                <Pressable
                  accessibilityLabel={`Adicionar em ${MEAL_TYPE_LABELS[bucket.mealType]}`}
                  onPress={() => router.push({ pathname: '/meal/capture', params: { mealType: bucket.mealType } })}
                  hitSlop={8}>
                  <Ionicons name="add-circle" color={theme.primary} size={22} />
                </Pressable>
              </View>
            </View>

            {mealsOfType.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nada registrado
              </ThemedText>
            ) : (
              mealsOfType.map((meal) => (
                <View key={meal.id} style={styles.mealItem}>
                  <View style={styles.mealHeader}>
                    <Pressable onPress={() => edit(meal)} style={{ flex: 1 }} accessibilityLabel="Editar refeição">
                      <ThemedText type="smallBold">
                        {meal.title ?? 'Refeição'} · {meal.totals.calories} kcal
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={() => edit(meal)} hitSlop={8} accessibilityLabel="Editar refeição">
                      <Ionicons name="create-outline" size={18} color={theme.primary} />
                    </Pressable>
                    <Pressable onPress={() => confirmRemove(meal)} hitSlop={8} accessibilityLabel="Excluir refeição">
                      <Ionicons name="trash-outline" size={18} color={theme.danger} />
                    </Pressable>
                  </View>
                  {meal.foods.map((food) => (
                    <ThemedText key={food.id} type="small" themeColor="textSecondary">
                      {food.nameSnapshot} · {Math.round(food.grams)}g · {food.totals.calories} kcal
                    </ThemedText>
                  ))}
                </View>
              ))
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  bucketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bucketRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mealItem: { gap: 2, paddingTop: Spacing.two },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
