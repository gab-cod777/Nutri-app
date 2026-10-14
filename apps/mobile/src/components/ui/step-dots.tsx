import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StepDots({ total, current }: { total: number; current: number }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index <= current ? theme.primary : theme.backgroundSelected,
              width: index === current ? 22 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.one },
  dot: { height: 8, borderRadius: 4 },
});
