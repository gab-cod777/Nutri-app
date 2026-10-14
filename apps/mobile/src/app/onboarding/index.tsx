import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Logo } from '@/components/ui/logo';
import { Screen } from '@/components/ui/screen';
import { StepDots } from '@/components/ui/step-dots';
import { ActivityStep } from '@/features/onboarding/steps/activity-step';
import { GoalStep } from '@/features/onboarding/steps/goal-step';
import { PhysicalStep } from '@/features/onboarding/steps/physical-step';
import { PreferencesStep } from '@/features/onboarding/steps/preferences-step';
import { SummaryStep } from '@/features/onboarding/steps/summary-step';
import { TrainingStep } from '@/features/onboarding/steps/training-step';
import { Spacing } from '@/constants/theme';
import { onboardingRequestFrom } from '@/features/onboarding/build-request';
import { perfilApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/api/queries';
import { queryClient } from '@/services/query-client';
import { useProfileStore } from '@/store/profile-store';

const TOTAL_STEPS = 6;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const draft = useProfileStore((state) => state.draft);
  const updateDraft = useProfileStore((state) => state.updateDraft);
  const resetDraft = useProfileStore((state) => state.resetDraft);

  // POST /perfil: grava o perfil, o consentimento e a primeira meta no servidor.
  const save = useMutation({
    mutationFn: () => {
      const body = onboardingRequestFrom(draft);
      if (!body) throw new Error('Onboarding incompleto');
      return perfilApi.onboarding(body);
    },
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.perfil, me);
      void queryClient.invalidateQueries({ queryKey: ['dieta'] });
      resetDraft();
      router.replace('/');
    },
  });

  function goNext<T extends Record<string, unknown>>(values: T) {
    updateDraft(values);
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
  }

  function handleConfirm() {
    save.mutate();
  }

  return (
    <Screen withTabBarInset={false}>
      <View style={styles.header}>
        {step > 0 ? (
          <Pressable onPress={goBack} hitSlop={12}>
            <ThemedText themeColor="primary">Voltar</ThemedText>
          </Pressable>
        ) : (
          <Logo size={24} withWordmark={false} />
        )}
        <StepDots total={TOTAL_STEPS} current={step} />
        <View style={{ width: 44 }} />
      </View>

      {step === 0 && <PhysicalStep draft={draft} onNext={goNext} />}
      {step === 1 && <GoalStep draft={draft} onNext={goNext} />}
      {step === 2 && <ActivityStep draft={draft} onNext={goNext} />}
      {step === 3 && <TrainingStep draft={draft} onNext={goNext} />}
      {step === 4 && <PreferencesStep draft={draft} onNext={goNext} />}
      {step === 5 && (
        <SummaryStep draft={draft} onConfirm={handleConfirm} submitting={save.isPending} submitError={save.error} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
});
