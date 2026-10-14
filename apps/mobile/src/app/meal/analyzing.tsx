import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyMessage } from '@/services/api/errors';
import { scanApi } from '@/services/api/endpoints';
import { useMealDraftStore } from '@/store/meal-draft-store';

/** A partir daqui, avisamos que a IA ainda esta trabalhando (1a analise pode carregar o modelo). */
const SLOW_AFTER_MS = 6_000;

/**
 * Foto -> POST /scan-prato (multipart) -> API -> servico de IA (Python/CLIP)
 * -> resultado real. Nao salva nada: a refeicao so e gravada na confirmacao.
 */
export default function AnalyzingScreen() {
  const theme = useTheme();
  const photo = useMealDraftStore((state) => state.photo);
  const mealType = useMealDraftStore((state) => state.mealType);
  const setFromAnalysis = useMealDraftStore((state) => state.setFromAnalysis);
  const [slow, setSlow] = useState(false);

  const scan = useMutation({
    mutationFn: () => scanApi.scanPrato(photo!, { mealType }),
    onSuccess: (result) => {
      if (!result.isFood) return; // mostramos o motivo nesta tela
      setFromAnalysis(result);
      router.replace('/meal/confirm');
    },
  });

  useEffect(() => {
    if (photo) scan.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Liga o aviso "a IA ainda esta processando" se a analise demorar.
  useEffect(() => {
    if (!scan.isPending) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [scan.isPending]);

  function retry() {
    setSlow(false);
    scan.mutate();
  }

  if (!photo) {
    return (
      <Screen withTabBarInset={false} style={styles.center}>
        <ThemedText>Nenhuma foto selecionada.</ThemedText>
        <Button label="Escolher foto" onPress={() => router.replace('/meal/capture')} />
      </Screen>
    );
  }

  const notFood = scan.isSuccess && !scan.data.isFood;

  return (
    <Screen withTabBarInset={false}>
      <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />

      {scan.isPending || scan.isIdle ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="smallBold" style={styles.text}>
            Analisando sua refeição...
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
            {slow && scan.isPending
              ? 'A IA ainda está processando a foto. Na primeira análise isso pode levar alguns segundos a mais.'
              : 'Enviando a foto e identificando os alimentos'}
          </ThemedText>
        </View>
      ) : null}

      {scan.isError ? (
        <Card style={styles.feedback}>
          <ThemedText type="smallBold">Não deu para analisar esta foto</ThemedText>
          <ThemedText themeColor="danger">{friendlyMessage(scan.error)}</ThemedText>
          <Button label="Tentar de novo" onPress={retry} />
          <Button label="Escolher outra foto" variant="secondary" onPress={() => router.replace('/meal/capture')} />
          <Button label="Registrar manualmente" variant="secondary" onPress={() => router.replace('/meal/search')} />
        </Card>
      ) : null}

      {notFood ? (
        <Card style={styles.feedback}>
          <ThemedText type="smallBold">Não encontramos comida nesta foto</ThemedText>
          <ThemedText themeColor="textSecondary">{scan.data.rejectionReason}</ThemedText>
          <Button label="Escolher outra foto" onPress={() => router.replace('/meal/capture')} />
          <Button label="Registrar manualmente" variant="secondary" onPress={() => router.replace('/meal/search')} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 220, borderRadius: 16 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  text: { textAlign: 'center' },
  feedback: { gap: Spacing.two },
});
