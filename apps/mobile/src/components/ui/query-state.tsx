import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyMessage } from '@/services/api/errors';

export function LoadingBlock({ label = 'Carregando...' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** Erro em linguagem de gente + botao de tentar de novo. Nunca mostra JSON/stack. */
export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Card style={styles.error}>
      <ThemedText themeColor="danger">{friendlyMessage(error)}</ThemedText>
      {onRetry ? <Button label="Tentar de novo" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  error: { gap: Spacing.two },
});
