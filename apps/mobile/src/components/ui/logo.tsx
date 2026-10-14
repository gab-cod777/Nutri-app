import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

const MARK_ASPECT_RATIO = 810 / 774;

export function Logo({ size = 32, withWordmark = true }: LogoProps) {
  const wordmarkStyle = [styles.wordmark, { fontSize: size * 0.7, lineHeight: size }];

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Nutrix">
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={{ width: size * MARK_ASPECT_RATIO, height: size }}
        contentFit="contain"
      />
      {withWordmark ? (
        <ThemedText style={wordmarkStyle}>
          Nutri
          <ThemedText themeColor="primary" style={wordmarkStyle}>
            x
          </ThemedText>
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordmark: {
    fontWeight: 600,
  },
});
