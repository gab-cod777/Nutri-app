import { DISCLAIMERS, type WorkoutDetail, type WorkoutLog } from '@nutrisnap/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { friendlyMessage, isNotFound } from '@/services/api/errors';
import { treinosApi } from '@/services/api/endpoints';
import { queryKeys, usePlanoTreino, useTreinoDia } from '@/services/api/queries';
import { queryClient } from '@/services/query-client';

/** Treino: o treino do dia (GET /treino-dia), o plano (GET /treinos/plano) e a execucao. */
export default function WorkoutScreen() {
  const dia = useTreinoDia();
  const plano = usePlanoTreino();

  const gerar = useMutation({
    mutationFn: () => treinosApi.gerar(false),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treinos'] });
    },
  });

  const semPlano = dia.isError && isNotFound(dia.error);

  return (
    <Screen>
      <ThemedText type="subtitle">Treino</ThemedText>

      {dia.isPending ? (
        <LoadingBlock />
      ) : semPlano ? (
        <Card style={styles.gap}>
          <ThemedText type="smallBold">Você ainda não tem um plano de treino</ThemedText>
          <ThemedText themeColor="textSecondary">
            Montamos um plano a partir do seu perfil: dias por semana, nível, objetivo e equipamentos.
          </ThemedText>
          {gerar.isError ? <ThemedText themeColor="danger">{friendlyMessage(gerar.error)}</ThemedText> : null}
          <Button label="Gerar meu plano" loading={gerar.isPending} onPress={() => gerar.mutate()} />
        </Card>
      ) : dia.isError ? (
        <ErrorBlock error={dia.error} onRetry={() => void dia.refetch()} />
      ) : dia.data.isRestDay || !dia.data.workout ? (
        <Card>
          <ThemedText type="smallBold">Hoje é dia de descanso</ThemedText>
          {dia.data.nextWorkout ? (
            <ThemedText themeColor="textSecondary">
              Próximo: {dia.data.nextWorkout.name} em {formatDate(dia.data.nextWorkout.date)}.
            </ThemedText>
          ) : null}
        </Card>
      ) : (
        <TodayWorkout workout={dia.data.workout} />
      )}

      {plano.isSuccess ? (
        <Card style={styles.gap}>
          <ThemedText type="smallBold">Seu plano: {plano.data.split}</ThemedText>
          {plano.data.workouts.map((w) => (
            <ThemedText key={w.id} type="small" themeColor="textSecondary">
              {w.name} · {w.exercises.length} exercícios · ~{w.estimatedDurationMinutes} min
            </ThemedText>
          ))}
        </Card>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        {DISCLAIMERS.workoutPlan}
      </ThemedText>
    </Screen>
  );
}

function TodayWorkout({ workout }: { workout: WorkoutDetail }) {
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const iniciar = useMutation({
    mutationFn: () => treinosApi.iniciar(workout.id),
    onSuccess: (result) => {
      setLog(result);
      setStartedAt(Date.now());
    },
  });

  const concluir = useMutation({
    mutationFn: () =>
      treinosApi.concluir(workout.id, Math.max(0, Math.round((Date.now() - (startedAt ?? Date.now())) / 1000))),
    onSuccess: (result) => {
      setLog(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.treinoDia });
    },
  });

  // Ja existe uma execucao aberta (ex.: app fechado no meio do treino).
  const activeLogId = log?.id ?? workout.activeLogId;
  const done = log?.status === 'completed' || workout.status === 'completed';

  return (
    <Card style={styles.gap}>
      <ThemedText type="smallBold">{workout.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        ~{workout.estimatedDurationMinutes} min · {workout.exercises.length} exercícios
      </ThemedText>

      {workout.exercises.map((we) => (
        <ExerciseRow
          key={we.id}
          name={we.exercise?.name ?? 'Exercício'}
          sets={we.sets}
          repsMin={we.repsMin}
          repsMax={we.repsMax}
          restSeconds={we.restSeconds}
          workoutExerciseId={we.id}
          workoutLogId={activeLogId && !done ? activeLogId : null}
          onLogged={setLog}
        />
      ))}

      {done ? (
        <ThemedText themeColor="primary">
          Treino concluído{log ? ` · volume ${log.totalVolumeKg} kg` : ''}. Bom trabalho!
        </ThemedText>
      ) : activeLogId ? (
        <Button label="Concluir treino" loading={concluir.isPending} onPress={() => concluir.mutate()} />
      ) : (
        <Button label="Iniciar treino" loading={iniciar.isPending} onPress={() => iniciar.mutate()} />
      )}
      {iniciar.isError ? <ThemedText themeColor="danger">{friendlyMessage(iniciar.error)}</ThemedText> : null}
      {concluir.isError ? <ThemedText themeColor="danger">{friendlyMessage(concluir.error)}</ThemedText> : null}
    </Card>
  );
}

function ExerciseRow(props: {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  workoutExerciseId: string;
  workoutLogId: string | null;
  onLogged: (log: WorkoutLog) => void;
}) {
  const [reps, setReps] = useState(String(props.repsMax));
  const [load, setLoad] = useState('');
  const [saved, setSaved] = useState(false);

  // POST /treinos/exercicios/:id/registro - idempotente: reenviar substitui as series.
  const registrar = useMutation({
    mutationFn: () =>
      treinosApi.registrar(
        props.workoutExerciseId,
        props.workoutLogId!,
        Array.from({ length: props.sets }, (_, i) => ({
          setNumber: i + 1,
          reps: Number(reps) || 0,
          loadKg: Number(load.replace(',', '.')) || 0,
          isWarmup: false,
        })),
      ),
    onSuccess: (result) => {
      setSaved(true);
      props.onLogged(result);
    },
  });

  return (
    <View style={styles.exercise}>
      <ThemedText type="smallBold">{props.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {props.sets} × {props.repsMin}-{props.repsMax} · descanso {props.restSeconds}s
      </ThemedText>
      {props.workoutLogId ? (
        <View style={styles.logRow}>
          <TextField label="Reps" keyboardType="number-pad" value={reps} onChangeText={setReps} style={styles.input} />
          <TextField label="Carga (kg)" keyboardType="numeric" value={load} onChangeText={setLoad} style={styles.input} />
          <View style={styles.logButton}>
            <Button
              label={saved ? 'Salvo ✓' : 'Registrar'}
              variant="secondary"
              loading={registrar.isPending}
              onPress={() => registrar.mutate()}
            />
          </View>
        </View>
      ) : null}
      {registrar.isError ? <ThemedText themeColor="danger">{friendlyMessage(registrar.error)}</ThemedText> : null}
    </View>
  );
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.two },
  exercise: { gap: 2, paddingVertical: Spacing.one },
  logRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
  input: { minWidth: 70 },
  logButton: { flex: 1 },
});
