import { physicalDataSchema } from '@nutrisnap/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { SEX_LABELS } from '@/lib/labels';
import type { OnboardingDraft } from '@/store/profile-store';

const step1Schema = physicalDataSchema.extend({
  displayName: z.string().trim().min(2, 'Digite pelo menos 2 letras').max(60),
});
type Step1Values = z.infer<typeof step1Schema>;

interface PhysicalStepProps {
  draft: OnboardingDraft;
  onNext: (values: Step1Values) => void;
}

export function PhysicalStep({ draft, onNext }: PhysicalStepProps) {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      displayName: draft.displayName ?? '',
      sex: draft.sex ?? 'female',
      birthDate: draft.birthDate ?? '',
      heightCm: draft.heightCm ?? undefined,
      weightKg: draft.weightKg ?? undefined,
      bodyFatPercentage: draft.bodyFatPercentage ?? undefined,
    },
  });

  const sex = watch('sex');

  const initialParts = draft.birthDate ? draft.birthDate.split('-') : ['', '', ''];
  const [year, setYear] = useState(initialParts[0] ?? '');
  const [month, setMonth] = useState(initialParts[1] ?? '');
  const [day, setDay] = useState(initialParts[2] ?? '');

  useEffect(() => {
    if (year.length === 4 && month && day) {
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      setValue('birthDate', iso, { shouldValidate: true });
    } else {
      setValue('birthDate', '', { shouldValidate: false });
    }
  }, [year, month, day, setValue]);

  useEffect(() => {
    setValue('sex', draft.sex ?? 'female');
  }, [draft.sex, setValue]);

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Sobre você</ThemedText>
      <ThemedText themeColor="textSecondary">
        Esses dados alimentam o cálculo da sua TMB e meta calórica.
      </ThemedText>

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Como podemos te chamar?"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.displayName?.message}
            placeholder="Seu nome"
          />
        )}
      />

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Sexo biológico (usado no cálculo de TMB)
        </ThemedText>
        <View style={styles.row}>
          {(Object.keys(SEX_LABELS) as (keyof typeof SEX_LABELS)[]).map((option) => (
            <Chip
              key={option}
              label={SEX_LABELS[option]}
              selected={sex === option}
              onPress={() => setValue('sex', option, { shouldValidate: true })}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Data de nascimento
        </ThemedText>
        <View style={styles.row}>
          <TextField
            label="Dia"
            keyboardType="number-pad"
            maxLength={2}
            value={day}
            onChangeText={(value) => setDay(value.replace(/[^0-9]/g, ''))}
            style={styles.dateInput}
          />
          <TextField
            label="Mês"
            keyboardType="number-pad"
            maxLength={2}
            value={month}
            onChangeText={(value) => setMonth(value.replace(/[^0-9]/g, ''))}
            style={styles.dateInput}
          />
          <TextField
            label="Ano"
            keyboardType="number-pad"
            maxLength={4}
            value={year}
            onChangeText={(value) => setYear(value.replace(/[^0-9]/g, ''))}
            style={styles.dateInput}
          />
        </View>
        {errors.birthDate ? (
          <ThemedText type="small" themeColor="danger">
            {errors.birthDate.message}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.row}>
        <Controller
          control={control}
          name="heightCm"
          render={({ field }) => (
            <TextField
              label="Altura (cm)"
              keyboardType="numeric"
              value={field.value ? String(field.value) : ''}
              onChangeText={(value) => field.onChange(Number(value.replace(/[^0-9]/g, '')))}
              error={errors.heightCm?.message}
              style={styles.half}
            />
          )}
        />
        <Controller
          control={control}
          name="weightKg"
          render={({ field }) => (
            <TextField
              label="Peso (kg)"
              keyboardType="numeric"
              value={field.value ? String(field.value) : ''}
              onChangeText={(value) => field.onChange(Number(value.replace(/[^0-9.]/g, '')))}
              error={errors.weightKg?.message}
              style={styles.half}
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="bodyFatPercentage"
        render={({ field }) => (
          <TextField
            label="% de gordura corporal (opcional, melhora a precisão)"
            keyboardType="numeric"
            value={field.value ? String(field.value) : ''}
            onChangeText={(value) =>
              field.onChange(value ? Number(value.replace(/[^0-9.]/g, '')) : undefined)
            }
            placeholder="Deixe em branco se não souber"
            error={errors.bodyFatPercentage?.message}
          />
        )}
      />

      <Button label="Continuar" onPress={handleSubmit(onNext)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  field: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  half: { flex: 1 },
  dateInput: { flex: 1 },
});
