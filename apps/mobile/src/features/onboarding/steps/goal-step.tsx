import type { Goal, GoalPace } from '@nutrisnap/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { GOAL_LABELS, GOAL_PACE_LABELS } from '@/lib/labels';
import type { OnboardingDraft } from '@/store/profile-store';

interface GoalStepProps {
  draft: OnboardingDraft;
  onNext: (values: { goal: Goal; pace: GoalPace }) => void;
}

export function GoalStep({ draft, onNext }: GoalStepProps) {
  const [goal, setGoal] = useState<Goal | undefined>(draft.goal);
  const [pace, setPace] = useState<GoalPace>(draft.pace ?? 'moderate');

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Qual é o seu objetivo?</ThemedText>

      <View style={styles.wrap}>
        {(Object.keys(GOAL_LABELS) as Goal[]).map((option) => (
          <Chip key={option} label={GOAL_LABELS[option]} selected={goal === option} onPress={() => setGoal(option)} />
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Ritmo desejado
      </ThemedText>
      <View style={styles.wrap}>
        {(Object.keys(GOAL_PACE_LABELS) as GoalPace[]).map((option) => (
          <Chip
            key={option}
            label={GOAL_PACE_LABELS[option]}
            selected={pace === option}
            onPress={() => setPace(option)}
          />
        ))}
      </View>

      <Button label="Continuar" disabled={!goal} onPress={() => goal && onNext({ goal, pace })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
