import type { DietaryRestriction } from '@nutrisnap/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { DIETARY_RESTRICTION_LABELS } from '@/lib/labels';
import type { OnboardingDraft } from '@/store/profile-store';

interface PreferencesStepProps {
  draft: OnboardingDraft;
  onNext: (values: { restrictions: DietaryRestriction[] }) => void;
}

export function PreferencesStep({ draft, onNext }: PreferencesStepProps) {
  const [restrictions, setRestrictions] = useState<DietaryRestriction[]>(draft.restrictions ?? []);

  function toggle(option: DietaryRestriction) {
    setRestrictions((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Restrições alimentares</ThemedText>
      <ThemedText themeColor="textSecondary">
        Opcional. Usamos isso para não sugerir alimentos incompatíveis no plano alimentar.
      </ThemedText>

      <View style={styles.wrap}>
        {(Object.keys(DIETARY_RESTRICTION_LABELS) as DietaryRestriction[]).map((option) => (
          <Chip
            key={option}
            label={DIETARY_RESTRICTION_LABELS[option]}
            selected={restrictions.includes(option)}
            onPress={() => toggle(option)}
          />
        ))}
      </View>

      <Button label="Continuar" onPress={() => onNext({ restrictions })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
