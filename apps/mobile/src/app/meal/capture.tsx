import { Ionicons } from '@expo/vector-icons';
import type { MealType } from '@nutrisnap/core';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMealDraftStore } from '@/store/meal-draft-store';

export default function CaptureScreen() {
  const params = useLocalSearchParams<{ mealType?: string }>();
  const setMealType = useMealDraftStore((state) => state.setMealType);
  const setPhoto = useMealDraftStore((state) => state.setPhoto);
  const reset = useMealDraftStore((state) => state.reset);

  useEffect(() => {
    reset();
    if (params.mealType) {
      setMealType(params.mealType as MealType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda o ARQUIVO (uri + tipo + nome): ele vai em multipart para POST /scan-prato.
  function handleAsset(asset: ImagePicker.ImagePickerAsset) {
    setPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? null, fileName: asset.fileName ?? null });
    router.push('/meal/analyzing');
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos da câmera para fotografar sua refeição.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!result.canceled && result.assets[0]) handleAsset(result.assets[0]);
  }

  async function handlePickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar suas fotos para escolher uma imagem.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) handleAsset(result.assets[0]);
  }

  return (
    <Screen withTabBarInset={false}>
      <ThemedText type="subtitle">Como foi sua refeição?</ThemedText>
      <ThemedText themeColor="textSecondary">
        Tire uma foto do prato e a gente estima as calorias. Ajuste depois se precisar.
      </ThemedText>

      <View style={styles.options}>
        <OptionButton icon="camera" label="Tirar foto" onPress={handleTakePhoto} />
        <OptionButton icon="images" label="Escolher da galeria" onPress={handlePickFromGallery} />
      </View>

      <Pressable onPress={() => router.push('/meal/search')} style={styles.manualLink}>
        <ThemedText type="link" themeColor="primary">
          Prefiro buscar o alimento manualmente
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

function OptionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionButton,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Ionicons name={icon} size={28} color={theme.primary} />
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { gap: Spacing.three, marginTop: Spacing.two },
  optionButton: {
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  manualLink: { alignItems: 'center', marginTop: Spacing.three },
});
