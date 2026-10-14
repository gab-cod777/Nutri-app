import type { ActivityLevel } from '@nutrisnap/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACTIVITY_LEVEL_HINTS, ACTIVITY_LEVEL_LABELS } from '@/lib/labels';
import type { OnboardingDraft } from '@/store/profile-store';

interface ActivityStepProps {
  draft: OnboardingDraft;
  onNext: (values: { activityLevel: ActivityLevel; trainingDaysPerWeek: number }) => void;
}

export function ActivityStep({ draft, onNext }: ActivityStepProps) {
  const theme = useTheme();
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | undefined>(draft.activityLevel);
  const [trainingDays, setTrainingDays] = useState(draft.trainingDaysPerWeek ?? 3);

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Rotina e atividade</ThemedText>
      <ThemedText themeColor="textSecondary">Isso define o multiplicador do seu gasto calórico total.</ThemedText>

      <View style={styles.list}>
        {(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((option) => {
          const selected = activityLevel === option;
          return (
            <Pressable
              key={option}
              onPress={() => setActivityLevel(option)}
              style={[
                styles.option,
                { backgroundColor: selected ? theme.primary : theme.backgroundElement },
              ]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.primaryText : theme.text }}>
                {ACTIVITY_LEVEL_LABELS[option]}
              </ThemedText>
              <ThemedText type="small" style={{ color: selected ? theme.primaryText : theme.textSecondary }}>
                {ACTIVITY_LEVEL_HINTS[option]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Dias de treino por semana: {trainingDays}
      </ThemedText>
      <View style={styles.wrap}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((day) => (
          <Pressable
            key={day}
            onPress={() => setTrainingDays(day)}
            style={[
              styles.dayChip,
              { backgroundColor: trainingDays === day ? theme.primary : theme.backgroundElement },
            ]}>
            <ThemedText style={{ color: trainingDays === day ? theme.primaryText : theme.text }}>{day}</ThemedText>
          </Pressable>
        ))}
      </View>

      <Button
        label="Continuar"
        disabled={!activityLevel}
        onPress={() => activityLevel && onNext({ activityLevel, trainingDaysPerWeek: trainingDays })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  list: { gap: Spacing.two },
  option: { borderRadius: 14, padding: Spacing.three, gap: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
