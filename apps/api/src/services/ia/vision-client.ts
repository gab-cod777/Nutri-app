import { z } from 'zod';
import type { PhotoMediaType } from '../../lib/image.js';

/**
 * Porta do servico de visao. Implementacao real: `PythonVisionClient`
 * (microsservico em apps/ia). Os testes usam um fake.
 *
 * O resultado volta como `unknown`: quem valida o formato e o `IaService`,
 * com o schema do core. Nada do servico de IA e confiado sem validacao.
 */
export interface VisionClient {
  analyze(input: { image: Buffer; mediaType: PhotoMediaType; userHint?: string | undefined }): Promise<VisionResponse>;
  /** true se o servico de IA responde ao /health. Usado no /health da API. */
  isHealthy(): Promise<boolean>;
}

export interface VisionResponse {
  readonly resultado?: unknown;
  readonly modelo: string;
  readonly versao: string;
}

export type VisionErrorKind = 'timeout' | 'unavailable' | 'rejected_image' | 'bad_response';

export class VisionError extends Error {
  constructor(
    readonly kind: VisionErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'VisionError';
  }
}

const envelopeSchema = z.object({
  resultado: z.unknown(),
  modelo: z.string().min(1).max(80),
  versao: z.string().min(1).max(30),
});

/** Cliente HTTP do servico Python (`POST /analisar`, multipart). */
export class PythonVisionClient implements VisionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(new URL('/health', this.baseUrl), { signal: AbortSignal.timeout(3_000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async analyze(input: { image: Buffer; mediaType: PhotoMediaType; userHint?: string | undefined }): Promise<VisionResponse> {
    const form = new FormData();
    form.append('foto', new Blob([new Uint8Array(input.image)], { type: input.mediaType }), 'foto');
    if (input.userHint) form.append('dica', input.userHint);

    let response: Response;
    try {
      response = await this.fetchImpl(new URL('/analisar', this.baseUrl), {
        method: 'POST',
        headers: { 'x-internal-token': this.internalToken },
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new VisionError(timedOut ? 'timeout' : 'unavailable', timedOut ? 'Tempo limite do servico de IA.' : String(error));
    }

    if (response.status === 413 || response.status === 422) {
      throw new VisionError('rejected_image', `Servico de IA recusou a imagem (${response.status}).`);
    }
    if (!response.ok) {
      throw new VisionError('unavailable', `Servico de IA respondeu ${response.status}.`);
    }
    const parsed = envelopeSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new VisionError('bad_response', 'Resposta do servico de IA fora do formato.');
    return parsed.data;
  }
}
