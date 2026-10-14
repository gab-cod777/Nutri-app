import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribeNoop = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * `useSyncExternalStore` reports `false` during server/static rendering and `true` once mounted
 * on the client, without the extra render pass an effect-driven flag would cause.
 */
function useHasHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export function useColorScheme() {
  const hasHydrated = useHasHydrated();
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
