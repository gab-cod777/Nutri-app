import { Ionicons } from '@expo/vector-icons';
import { scaleNutritionByGrams, sumNutrition, type CreateMealInput, type MealType } from '@nutrisnap/core';
import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MEAL_TYPE_LABELS } from '@/lib/labels';
import { friendlyMessage } from '@/services/api/errors';
import { diarioApi } from '@/services/api/endpoints';
import { queryClient } from '@/services/query-client';
import { useMealDraftStore, type ConfirmationReason, type MealDraftItem } from '@/store/meal-draft-store';

const REASON_LABELS: Record<ConfirmationReason, string> = {
  low_confidence: 'A foto não permite medir a quantidade com precisão',
  poor_image_quality: 'A foto está escura, borrada ou cortada',
  hidden_calories: 'Pode haver óleo, molho ou açúcar que a foto não mostra',
  no_match_in_database: 'Alguns alimentos não estão na nossa base',
};

/**
 * "Confirme a porcao": o usuario revisa o que a IA identificou, ajusta as
 * gramas e salva. Os valores por item aqui sao uma PREVIA (mesma funcao do
 * core que a API usa); o total oficial e o que a API devolve ao salvar.
 */
export default function ConfirmScreen() {
  const theme = useTheme();
  const draft = useMealDraftStore();
  const { items, mealType, photo, editingMealId } = draft;

  const preview = useMemo(
    () => sumNutrition(items.map((item) => scaleNutritionByGrams(item.per100gSnapshot, item.grams))),
    [items],
  );

  const save = useMutation({
    mutationFn: () => {
      const foods: CreateMealInput['foods'] = items.map((item) => ({
        foodId: item.foodId,
        nameSnapshot: item.nameSnapshot,
        per100gSnapshot: item.per100gSnapshot,
        quantity: item.grams,
        unit: item.unit,
        grams: item.grams,
        preparationMethod: item.preparationMethod,
        portionSource: item.portionSource,
        aiConfidence: item.aiConfidence ?? null,
        aiEstimatedGrams: item.aiEstimatedGrams ?? null,
      }));
      if (editingMealId) return diarioApi.update(editingMealId, { mealType, foods });
      return diarioApi.create({
        mealType,
        consumedAt: new Date().toISOString(),
        title: draft.description,
        analysisId: draft.analysisId,
        foods,
      });
    },
    onSuccess: (meal) => {
      // O diario e o resumo do dia vem da API: invalidar faz as telas buscarem de novo.
      void queryClient.invalidateQueries({ queryKey: ['diario', meal.localDate] });
      void queryClient.invalidateQueries({ queryKey: ['dieta', 'resumo', meal.localDate] });
      draft.reset();
      router.dismissAll();
      router.navigate('/(tabs)/diary');
    },
  });

  function handleSave() {
    if (items.length === 0) {
      Alert.alert('Nada para salvar', 'Adicione ao menos um alimento antes de salvar.');
      return;
    }
    if (items.some((item) => item.grams <= 0)) {
      Alert.alert('Porção inválida', 'Informe a quantidade em gramas de todos os alimentos.');
      return;
    }
    save.mutate();
  }

  return (
    <Screen withTabBarInset={false}>
      {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" /> : null}

      {!editingMealId && draft.analysisId ? (
        <Card style={styles.confirmCard}>
          <View style={styles.row}>
            <Ionicons name="scale-outline" size={20} color={theme.primary} />
            <ThemedText type="smallBold">Confirme a porção</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            A câmera não mede peso. Confira a quantidade de cada alimento (P / M / G ou em gramas) antes de salvar.
          </ThemedText>
          {draft.confirmationReasons.map((reason) => (
            <ThemedText key={reason} type="small">
              • {REASON_LABELS[reason]}
            </ThemedText>
          ))}
        </Card>
      ) : null}

      <View style={styles.mealTypeRow}>
        {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((option) => (
          <Chip
            key={option}
            label={MEAL_TYPE_LABELS[option]}
            selected={mealType === option}
            onPress={() => draft.setMealType(option)}
          />
        ))}
      </View>

      {items.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">Nenhum alimento ainda.</ThemedText>
        </Card>
      ) : (
        items.map((item) => (
          <FoodRow
            key={item.clientId}
            item={item}
            onChangeGrams={(grams) => draft.updateGrams(item.clientId, grams)}
            onRemove={() => draft.removeItem(item.clientId)}
          />
        ))
      )}

      <Pressable onPress={() => router.push({ pathname: '/meal/search', params: { from: 'confirm' } })} style={styles.addRow}>
        <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
        <ThemedText type="link" themeColor="primary">
          Adicionar alimento
        </ThemedText>
      </Pressable>

      <Card style={styles.totalsCard}>
        <ThemedText type="smallBold">Total estimado</ThemedText>
        <ThemedText type="title" style={styles.totalCalories}>
          {Math.round(preview.calories)} kcal
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          P {Math.round(preview.protein)}g · C {Math.round(preview.carbs)}g · G {Math.round(preview.fat)}g
        </ThemedText>
      </Card>

      {draft.disclaimer ? (
        <ThemedText type="small" themeColor="textSecondary">
          {draft.disclaimer}
        </ThemedText>
      ) : null}

      {save.isError ? <ThemedText themeColor="danger">{friendlyMessage(save.error)}</ThemedText> : null}

      <Button
        label={editingMealId ? 'Salvar alterações' : 'Confirmar e salvar'}
        loading={save.isPending}
        onPress={handleSave}
      />
    </Screen>
  );
}

function FoodRow({
  item,
  onChangeGrams,
  onRemove,
}: {
  item: MealDraftItem;
  onChangeGrams: (grams: number) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const totals = scaleNutritionByGrams(item.per100gSnapshot, item.grams);
  const hasRange = item.minGrams !== undefined && item.maxGrams !== undefined && item.aiEstimatedGrams != null;

  return (
    <Card>
      <View style={styles.foodHeader}>
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          {item.nameSnapshot}
        </ThemedText>
        {item.aiConfidence != null ? (
          <ThemedText type="small" themeColor="textSecondary">
            confiança {Math.round(item.aiConfidence * 100)}%
          </ThemedText>
        ) : null}
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remover ${item.nameSnapshot}`}>
          <Ionicons name="trash-outline" size={18} color={theme.danger} />
        </Pressable>
      </View>

      {hasRange ? (
        <View style={styles.portionRow}>
          <Chip label={`P ${item.minGrams}g`} selected={item.grams === item.minGrams} onPress={() => onChangeGrams(item.minGrams!)} />
          <Chip
            label={`M ${item.aiEstimatedGrams}g`}
            selected={item.grams === item.aiEstimatedGrams}
            onPress={() => onChangeGrams(item.aiEstimatedGrams!)}
          />
          <Chip label={`G ${item.maxGrams}g`} selected={item.grams === item.maxGrams} onPress={() => onChangeGrams(item.maxGrams!)} />
        </View>
      ) : null}

      <View style={styles.gramsRow}>
        <TextInput
          keyboardType="numeric"
          accessibilityLabel={`Gramas de ${item.nameSnapshot}`}
          value={String(item.grams)}
          onChangeText={(value) => onChangeGrams(Number(value.replace(/[^0-9]/g, '')) || 0)}
          style={[styles.gramsInput, { color: theme.text, borderColor: theme.border }]}
        />
        <ThemedText themeColor="textSecondary"> g</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.calorieText}>
          {Math.round(totals.calories)} kcal · P {totals.protein} · C {totals.carbs} · G {totals.fat}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 180, borderRadius: 16 },
  confirmCard: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  mealTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, justifyContent: 'center' },
  totalsCard: { alignItems: 'center' },
  totalCalories: { fontSize: 30, lineHeight: 36 },
  foodHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  portionRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  gramsRow: { flexDirection: 'row', alignItems: 'center' },
  gramsInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    width: 70,
    fontSize: 16,
  },
  calorieText: { marginLeft: 'auto' },
});
