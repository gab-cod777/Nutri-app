import { Ionicons } from '@expo/vector-icons';
import type { Food } from '@nutrisnap/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBlock, LoadingBlock } from '@/components/ui/query-state';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { alimentosApi } from '@/services/api/endpoints';
import { useMealDraftStore } from '@/store/meal-draft-store';

/** Porcao inicial: a porcao padrao cadastrada no alimento, senao 100 g. */
function defaultGrams(food: Food): number {
  return food.servings.find((s) => s.isDefault)?.gramsEquivalent ?? 100;
}

/** Busca manual na base de alimentos da API (GET /alimentos?q=). */
export default function SearchFoodScreen() {
  const theme = useTheme();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const addManualFood = useMealDraftStore((state) => state.addManualFood);
  const items = useMealDraftStore((state) => state.items);

  // Espera o usuario parar de digitar (a API limita 60 buscas/min).
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useQuery({
    queryKey: ['alimentos', debounced],
    queryFn: () => alimentosApi.search(debounced),
    enabled: debounced.length >= 2,
  });

  const addedIds = useMemo(() => new Set(items.map((item) => item.foodId)), [items]);

  function handleDone() {
    // Aberta pela confirmacao: volta para ela. Aberta de outro lugar: vira a confirmacao.
    if (from === 'confirm' && router.canGoBack()) router.back();
    else router.replace('/meal/confirm');
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchBox}>
        <TextField
          label="Alimento"
          placeholder="Ex.: arroz, frango, banana..."
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      </View>

      {debounced.length < 2 ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          Digite pelo menos 2 letras.
        </ThemedText>
      ) : search.isPending ? (
        <LoadingBlock label="Buscando..." />
      ) : search.isError ? (
        <View style={styles.list}>
          <ErrorBlock error={search.error} onRetry={() => void search.refetch()} />
        </View>
      ) : (
        <FlatList
          data={search.data.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const alreadyAdded = addedIds.has(item.id);
            return (
              <Pressable
                onPress={() => !alreadyAdded && addManualFood(item, defaultGrams(item))}
                style={[styles.row, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.per100g.calories} kcal / 100g · porção {defaultGrams(item)}g
                  </ThemedText>
                </View>
                <Ionicons
                  name={alreadyAdded ? 'checkmark-circle' : 'add-circle-outline'}
                  size={24}
                  color={alreadyAdded ? theme.primary : theme.text}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Nenhum alimento encontrado.
            </ThemedText>
          }
        />
      )}

      <View style={styles.footer}>
        <Button label="Concluir" onPress={handleDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBox: { padding: Spacing.three },
  list: { paddingHorizontal: Spacing.three, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  footer: { padding: Spacing.three },
});
