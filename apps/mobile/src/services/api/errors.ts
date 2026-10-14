import { API_URL } from '@/config/api';

/** Erro devolvido pela API no formato `{ error: { code, message, details, requestId } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Nao chegou resposta: servidor fora do ar, IP/porta errados, rede diferente ou timeout. */
export class NetworkError extends Error {
  constructor(readonly timedOut: boolean) {
    super(timedOut ? 'Tempo de resposta esgotado.' : 'Sem conexao com o servidor.');
    this.name = 'NetworkError';
  }
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_in_use: 'Já existe uma conta com este e-mail. Tente entrar.',
  invalid_token: 'Sua sessão expirou. Entre novamente.',
  token_revoked: 'Sua sessão foi encerrada. Entre novamente.',
  missing_token: 'Sua sessão expirou. Entre novamente.',
  onboarding_required: 'Complete seu perfil para continuar.',
  photo_required: 'Nenhuma foto foi enviada. Tente escolher a foto de novo.',
  photo_empty: 'A foto chegou vazia. Tire outra foto ou escolha outra imagem da galeria.',
  photo_too_large: 'A foto é grande demais (máximo 5 MB). Tente outra imagem.',
  unsupported_image: 'Esse arquivo não é uma imagem que conseguimos ler (use JPEG, PNG ou WebP).',
  ai_unavailable: 'A análise de fotos está indisponível agora. Tente de novo em instantes ou registre manualmente.',
  ai_invalid_output: 'Não conseguimos um resultado confiável para essa foto. Tente outra foto ou registre manualmente.',
  daily_scan_limit_reached: 'Você atingiu o limite de análises de foto por hoje. Registre manualmente.',
  rate_limited: 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.',
  analysis_already_used: 'Esta análise já foi salva no diário.',
  active_plan_exists: 'Você já tem um plano ativo.',
  workout_in_progress: 'Já existe um treino em andamento.',
  workout_not_started: 'Este treino ainda não foi iniciado.',
  not_found: 'Não encontramos o que você procurou.',
  invalid_response: 'O servidor respondeu em um formato inesperado. Atualize o app e a API.',
};

/**
 * Mensagem que pode ir para a tela. Nunca mostra JSON, stack trace ou
 * detalhe interno - so texto pensado para o usuario.
 */
export function friendlyMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return error.timedOut
      ? 'O servidor demorou demais para responder. Verifique se a API está rodando e tente de novo.'
      : `Não foi possível conectar ao servidor (${API_URL}). Verifique se a API está rodando e se o celular está na mesma rede.`;
  }
  if (error instanceof ApiError) {
    if (MESSAGES[error.code]) return MESSAGES[error.code]!;
    if (error.code === 'validation_failed') {
      const issues = (error.details?.issues as { message?: string }[] | undefined) ?? [];
      return issues[0]?.message ? `Dados inválidos: ${issues[0].message}` : 'Alguns dados estão inválidos. Revise e tente de novo.';
    }
    if (error.status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.';
    return error.message || 'Não foi possível concluir a operação.';
  }
  return 'Algo deu errado. Tente de novo.';
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
