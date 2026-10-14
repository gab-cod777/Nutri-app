import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface ScreenProps extends ViewProps {
  scroll?: boolean;
  withTabBarInset?: boolean;
}

/** Container padrao de tela: respeita safe area, centraliza em telas largas (web). */
export function Screen({ children, style, scroll = true, withTabBarInset = true, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const Container = scroll ? ScrollView : View;
  const containerProps = scroll
    ? { contentContainerStyle: styles.content, keyboardShouldPersistTaps: 'handled' as const }
    : { style: styles.content };

  return (
    <ThemedView style={styles.root}>
      <Container
        {...containerProps}
        style={[
          scroll ? { paddingTop: insets.top + Spacing.three } : undefined,
          !scroll && { paddingTop: insets.top + Spacing.three, flex: 1 },
        ]}>
        <View
          style={[
            styles.inner,
            {
              paddingBottom: insets.bottom + (withTabBarInset ? BottomTabInset : 0) + Spacing.five,
              paddingHorizontal: Spacing.three,
            },
            style,
          ]}
          {...rest}>
          {children}
        </View>
      </Container>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
});
