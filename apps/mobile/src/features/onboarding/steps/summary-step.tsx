import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/query-state';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { energyPlanRequestFrom } from '@/features/onboarding/build-request';
import { GOAL_LABELS } from '@/lib/labels';
import { friendlyMessage } from '@/services/api/errors';
import { dietaApi } from '@/services/api/endpoints';
import type { OnboardingDraft } from '@/store/profile-store';

interface SummaryStepProps {
  draft: OnboardingDraft;
  onConfirm: () => void;
  submitting: boolean;
  submitError: unknown;
}

/**
 * Previa da meta calculada pelo SERVIDOR (POST /calculo-fisico) + consentimento
 * LGPD, obrigatorio para salvar dados de saude (POST /perfil exige).
 */
export function SummaryStep({ draft, onConfirm, submitting, submitError }: SummaryStepProps) {
  const theme = useTheme();
  const [consent, setConsent] = useState(false);
  const request = energyPlanRequestFrom(draft);

  const plan = useQuery({
    queryKey: ['calculo-fisico', request],
    queryFn: () => dietaApi.calculoFisico(request!),
    enabled: request !== null,
  });

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Prontinho, {draft.displayName?.split(' ')[0]}</ThemedText>
      <ThemedText themeColor="textSecondary">
        Essa é sua meta calórica inicial. Você pode ajustar depois no seu perfil.
      </ThemedText>

      {!request ? (
        <ThemedText themeColor="danger">Faltam dados para calcular sua meta. Volte e revise os passos.</ThemedText>
      ) : plan.isPending ? (
        <LoadingBlock label="Calculando sua meta..." />
      ) : plan.isError ? (
        <ErrorBlock error={plan.error} onRetry={() => void plan.refetch()} />
      ) : (
        <Card>
          <ThemedText type="title" style={styles.calories}>
            {plan.data.calories.targetCalories} kcal/dia
          </ThemedText>
          <ThemedText themeColor="textSecondary">Objetivo: {GOAL_LABELS[draft.goal!]}</ThemedText>
          <View style={styles.macrosRow}>
            <MacroPreview label="Proteína" grams={plan.data.macros.protein.grams} color="protein" />
            <MacroPreview label="Carbo" grams={plan.data.macros.carbs.grams} color="carbs" />
            <MacroPreview label="Gordura" grams={plan.data.macros.fat.grams} color="fat" />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            TMB: {plan.data.bmr.bmr} kcal · TDEE: {plan.data.tdee.tdee} kcal
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plan.data.disclaimer}
          </ThemedText>
        </Card>
      )}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent((value) => !value)}
        style={styles.consent}>
        <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={24} color={theme.primary} />
        <ThemedText type="small" style={{ flex: 1 }}>
          Autorizo o Nutrix a tratar meus dados de saúde (peso, medidas e fotos de refeições) para calcular metas e
          registrar minha alimentação, conforme a LGPD. Posso excluir minha conta e todos os dados a qualquer momento.
        </ThemedText>
      </Pressable>

      {submitError ? <ThemedText themeColor="danger">{friendlyMessage(submitError)}</ThemedText> : null}

      <Button
        label="Concluir e começar"
        disabled={!plan.isSuccess || !consent}
        loading={submitting}
        onPress={onConfirm}
      />
    </View>
  );
}

function MacroPreview({ label, grams, color }: { label: string; grams: number; color: 'protein' | 'carbs' | 'fat' }) {
  return (
    <View style={styles.macroItem}>
      <ThemedText type="smallBold" themeColor={color}>
        {grams}g
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  calories: { fontSize: 32, lineHeight: 38 },
  macrosRow: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
  macroItem: { alignItems: 'center', gap: 2 },
  consent: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
});
