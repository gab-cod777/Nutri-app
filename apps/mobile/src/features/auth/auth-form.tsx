import { loginRequestSchema, signUpRequestSchema } from '@nutrisnap/core';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { API_URL } from '@/config/api';
import { Spacing } from '@/constants/theme';
import { friendlyMessage } from '@/services/api/errors';
import { authApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth-store';

/**
 * Formulario de cadastro (POST /cadastro) e login (POST /login).
 * Depois do sucesso, o token vai para o SecureStore e os guardas de rota
 * levam o usuario ao onboarding (perfil novo) ou ao app.
 */
export function AuthForm({ mode }: { mode: 'login' | 'cadastro' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const signIn = useAuthStore((state) => state.signIn);
  const notice = useAuthStore((state) => state.notice);
  const clearNotice = useAuthStore((state) => state.clearNotice);

  const mutation = useMutation({
    mutationFn: () => (mode === 'login' ? authApi.login(email, password) : authApi.signUp(email, password)),
    onSuccess: (auth) => signIn(auth),
  });

  function submit() {
    clearNotice();
    const schema = mode === 'login' ? loginRequestSchema : signUpRequestSchema;
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setFieldError(
        issue?.path[0] === 'email' ? 'Digite um e-mail válido.' : (issue?.message ?? 'Confira os dados.'),
      );
      return;
    }
    setFieldError(null);
    mutation.mutate();
  }

  const isLogin = mode === 'login';

  return (
    <Screen withTabBarInset={false}>
      <View style={styles.header}>
        <Logo size={40} />
        <ThemedText type="subtitle">{isLogin ? 'Entrar' : 'Criar conta'}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {isLogin ? 'Bem-vindo de volta.' : 'Leva menos de um minuto. Depois montamos seu perfil.'}
        </ThemedText>
      </View>

      {notice ? (
        <Card>
          <ThemedText themeColor="danger">{notice}</ThemedText>
        </Card>
      ) : null}

      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="voce@exemplo.com"
      />
      <TextField
        label={isLogin ? 'Senha' : 'Senha (mínimo 8 caracteres)'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={isLogin ? 'current-password' : 'new-password'}
      />

      {fieldError ? <ThemedText themeColor="danger">{fieldError}</ThemedText> : null}
      {mutation.isError ? <ThemedText themeColor="danger">{friendlyMessage(mutation.error)}</ThemedText> : null}

      <Button label={isLogin ? 'Entrar' : 'Criar conta'} loading={mutation.isPending} onPress={submit} />

      <Link href={isLogin ? '/cadastro' : '/login'} replace style={styles.link}>
        <ThemedText type="link" themeColor="primary">
          {isLogin ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
        </ThemedText>
      </Link>

      <ThemedText type="small" themeColor="textSecondary" style={styles.server}>
        Servidor: {API_URL}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  link: { alignSelf: 'center', marginTop: Spacing.two },
  server: { textAlign: 'center', marginTop: Spacing.four },
});
