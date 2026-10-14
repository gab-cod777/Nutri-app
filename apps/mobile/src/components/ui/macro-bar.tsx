import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number;
  color: ThemeColor;
  unit?: string;
}

export function MacroBar({ label, consumed, target, color, unit = 'g' }: MacroBarProps) {
  const theme = useTheme();
  const percent = target > 0 ? Math.min(1, consumed / target) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(consumed)}
          {unit} / {Math.round(target)}
          {unit}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${percent * 100}%`, backgroundColor: theme[color] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
