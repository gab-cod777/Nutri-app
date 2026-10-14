import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { API_URL } from '@/config/api';
import { Spacing } from '@/constants/theme';
import { ACTIVITY_LEVEL_LABELS, GOAL_LABELS, SEX_LABELS } from '@/lib/labels';
import { friendlyMessage } from '@/services/api/errors';
import { perfilApi } from '@/services/api/endpoints';
import { queryKeys, useMeta, usePerfil } from '@/services/api/queries';
import { queryClient } from '@/services/query-client';
import { useAuthStore } from '@/store/auth-store';
import { useProfileStore } from '@/store/profile-store';

/** Perfil (GET/PUT/DELETE /perfil) e meta vigente (GET /dieta/meta). */
export default function ProfileScreen() {
  const perfil = usePerfil();
  const meta = useMeta();
  const signOut = useAuthStore((state) => state.signOut);
  const email = useAuthStore((state) => state.user?.email);
  const loadFromProfile = useProfileStore((state) => state.loadFromProfile);
  const [weight, setWeight] = useState('');

  // Mudar o peso cria uma nova meta no servidor (a anterior fica no historico).
  const updateWeight = useMutation({
    mutationFn: (weightKg: number) => perfilApi.update({ weightKg }),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.perfil, me);
      void queryClient.invalidateQueries({ queryKey: ['dieta'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.planoAlimentar });
      setWeight('');
    },
  });

  const deleteAccount = useMutation({
    mutationFn: perfilApi.deleteAccount,
    onSuccess: () => void signOut(),
    onError: (error) => Alert.alert('Não foi possível excluir', friendlyMessage(error)),
  });

  if (perfil.isPending) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }
  if (perfil.isError || !perfil.data.profile) {
    return (
      <Screen>
        <ErrorBlock error={perfil.error} onRetry={() => void perfil.refetch()} />
      </Screen>
    );
  }
  const profile = perfil.data.profile;

  function handleRedoOnboarding() {
    loadFromProfile(profile);
    router.push('/onboarding');
  }

  function handleLogout() {
    Alert.alert('Sair', 'Encerrar a sessão neste aparelho?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void signOut({ callApi: true }) },
    ]);
  }

  function handleDelete() {
    Alert.alert(
      'Excluir conta',
      'Isso apaga sua conta e TODOS os seus dados (perfil, diário, metas, treinos). Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir tudo', style: 'destructive', onPress: () => deleteAccount.mutate() },
      ],
    );
  }

  function handleWeight() {
    const value = Number(weight.replace(',', '.'));
    if (!value) return;
    updateWeight.mutate(value);
  }

  return (
    <Screen>
      <ThemedText type="subtitle">{profile.displayName}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {email}
      </ThemedText>

      <Card>
        <ThemedText type="smallBold">Dados</ThemedText>
        <Row label="Sexo" value={SEX_LABELS[profile.sex]} />
        <Row label="Altura" value={`${profile.heightCm} cm`} />
        <Row label="Peso" value={`${profile.weightKg} kg`} />
        <Row label="Objetivo" value={GOAL_LABELS[profile.goal]} />
        <Row label="Nível de atividade" value={ACTIVITY_LEVEL_LABELS[profile.activityLevel]} />
      </Card>

      <Card>
        <ThemedText type="smallBold">Meta atual</ThemedText>
        {meta.isPending ? (
          <LoadingBlock />
        ) : meta.isError ? (
          <ErrorBlock error={meta.error} onRetry={() => void meta.refetch()} />
        ) : (
          <>
            <Row label="TMB" value={`${meta.data.bmr} kcal`} />
            <Row label="TDEE" value={`${meta.data.tdee} kcal`} />
            <Row label="Meta diária" value={`${meta.data.calories} kcal`} />
            <Row label="Proteína" value={`${meta.data.protein} g`} />
            <Row label="Carboidrato" value={`${meta.data.carbs} g`} />
            <Row label="Gordura" value={`${meta.data.fat} g`} />
            <ThemedText type="small" themeColor="textSecondary">
              {meta.data.disclaimer}
            </ThemedText>
          </>
        )}
      </Card>

      <Card style={styles.gap}>
        <ThemedText type="smallBold">Atualizar peso</ThemedText>
        <TextField label="Peso atual (kg)" keyboardType="numeric" value={weight} onChangeText={setWeight} />
        {updateWeight.isError ? <ThemedText themeColor="danger">{friendlyMessage(updateWeight.error)}</ThemedText> : null}
        <Button label="Salvar e recalcular meta" loading={updateWeight.isPending} onPress={handleWeight} />
      </Card>

      <Button label="Refazer questionário" variant="secondary" onPress={handleRedoOnboarding} />
      <Button label="Sair" variant="secondary" onPress={handleLogout} />
      <Button label="Excluir conta e dados" variant="danger" loading={deleteAccount.isPending} onPress={handleDelete} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.server}>
        Servidor: {API_URL}
      </ThemedText>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.half },
  gap: { gap: Spacing.two },
  server: { textAlign: 'center' },
});
