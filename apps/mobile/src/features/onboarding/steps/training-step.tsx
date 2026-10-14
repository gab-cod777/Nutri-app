import type { Equipment, TrainingExperience, TrainingLocation } from '@nutrisnap/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { EQUIPMENT_LABELS, TRAINING_EXPERIENCE_LABELS, TRAINING_LOCATION_LABELS } from '@/lib/labels';
import type { OnboardingDraft } from '@/store/profile-store';

interface TrainingStepProps {
  draft: OnboardingDraft;
  onNext: (values: {
    experience: TrainingExperience;
    location: TrainingLocation;
    availableEquipment: Equipment[];
  }) => void;
}

export function TrainingStep({ draft, onNext }: TrainingStepProps) {
  const [experience, setExperience] = useState<TrainingExperience | undefined>(draft.experience);
  const [location, setLocation] = useState<TrainingLocation | undefined>(draft.location);
  const [equipment, setEquipment] = useState<Equipment[]>(draft.availableEquipment ?? []);

  function toggleEquipment(option: Equipment) {
    setEquipment((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    );
  }

  const canContinue = !!experience && !!location && equipment.length > 0;

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Seu treino</ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        Experiência
      </ThemedText>
      <View style={styles.wrap}>
        {(Object.keys(TRAINING_EXPERIENCE_LABELS) as TrainingExperience[]).map((option) => (
          <Chip
            key={option}
            label={TRAINING_EXPERIENCE_LABELS[option]}
            selected={experience === option}
            onPress={() => setExperience(option)}
          />
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Onde você treina
      </ThemedText>
      <View style={styles.wrap}>
        {(Object.keys(TRAINING_LOCATION_LABELS) as TrainingLocation[]).map((option) => (
          <Chip
            key={option}
            label={TRAINING_LOCATION_LABELS[option]}
            selected={location === option}
            onPress={() => setLocation(option)}
          />
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Equipamentos disponíveis (escolha ao menos um)
      </ThemedText>
      <View style={styles.wrap}>
        {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((option) => (
          <Chip
            key={option}
            label={EQUIPMENT_LABELS[option]}
            selected={equipment.includes(option)}
            onPress={() => toggleEquipment(option)}
          />
        ))}
      </View>

      <Button
        label="Continuar"
        disabled={!canContinue}
        onPress={() => canContinue && onNext({ experience: experience!, location: location!, availableEquipment: equipment })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
