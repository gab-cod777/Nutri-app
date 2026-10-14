import { diffDays, DISCLAIMERS, startOfIsoWeek } from '@nutrisnap/core';
import { useMutation } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { MEAL_TYPE_LABELS } from '@/lib/labels';
import { friendlyMessage, isNotFound } from '@/services/api/errors';
import { planoAlimentarApi } from '@/services/api/endpoints';
import { queryKeys, usePlanoAlimentar, useToday } from '@/services/api/queries';
import { queryClient } from '@/services/query-client';

/** Plano alimentar (GET /plano-alimentar): cardapio do dia, gerado pela API a partir da meta. */
export default function PlanScreen() {
  const today = useToday();
  const plano = usePlanoAlimentar();

  const gerar = useMutation({
    mutationFn: (force: boolean) => planoAlimentarApi.gerar(force),
    onSuccess: (plan) => queryClient.setQueryData(queryKeys.planoAlimentar, plan),
  });
  const trocar = useMutation({
    mutationFn: (mealId: string) => planoAlimentarApi.trocarRefeicao(mealId),
    onSuccess: (plan) => queryClient.setQueryData(queryKeys.planoAlimentar, plan),
  });

  // dayIndex do plano: 0 = segunda-feira.
  const todayIndex = diffDays(startOfIsoWeek(today), today);
  const day = plano.data?.days.find((d) => d.dayIndex === todayIndex) ?? plano.data?.days[0];

  return (
    <Screen>
      <ThemedText type="subtitle">Plano alimentar</ThemedText>

      {plano.isPending ? (
        <LoadingBlock />
      ) : plano.isError && isNotFound(plano.error) ? (
        <Card style={styles.gap}>
          <ThemedText type="smallBold">Você ainda não tem um plano alimentar</ThemedText>
          <ThemedText themeColor="textSecondary">
            Montamos um cardápio de 7 dias na sua meta, respeitando suas restrições.
          </ThemedText>
          {gerar.isError ? <ThemedText themeColor="danger">{friendlyMessage(gerar.error)}</ThemedText> : null}
          <Button label="Gerar meu plano" loading={gerar.isPending} onPress={() => gerar.mutate(false)} />
        </Card>
      ) : plano.isError ? (
        <ErrorBlock error={plano.error} onRetry={() => void plano.refetch()} />
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            Hoje: {day?.totals.calories} kcal · meta {plano.data.targetCalories} kcal
          </ThemedText>
          {day?.meals.map((meal) => (
            <Card key={meal.id} style={styles.gap}>
              <View style={styles.mealHeader}>
                <ThemedText type="smallBold" style={{ flex: 1 }}>
                  {MEAL_TYPE_LABELS[meal.mealType]} · {meal.suggestedTime}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {meal.totals.calories} kcal
                </ThemedText>
              </View>
              {meal.items.map((item) => (
                <ThemedText key={item.id} type="small">
                  {item.name} · {item.grams}g
                </ThemedText>
              ))}
              <Button
                label="Trocar refeição"
                variant="secondary"
                loading={trocar.isPending && trocar.variables === meal.id}
                onPress={() => trocar.mutate(meal.id)}
              />
            </Card>
          ))}
          {trocar.isError ? <ThemedText themeColor="danger">{friendlyMessage(trocar.error)}</ThemedText> : null}
          <Button label="Gerar novo plano" variant="secondary" loading={gerar.isPending} onPress={() => gerar.mutate(true)} />
        </>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {DISCLAIMERS.mealPlan}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.two },
  mealHeader: { flexDirection: 'row', alignItems: 'center' },
});
