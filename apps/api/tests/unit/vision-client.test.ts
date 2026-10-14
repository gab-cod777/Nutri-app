import { PythonVisionClient, VisionError } from '../../src/services/ia/vision-client.js';

const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

function fakeFetch(handler: (url: URL, init: RequestInit) => Promise<Response>) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const impl = (async (url: URL, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('PythonVisionClient', () => {
  it('envia multipart com a foto, a dica e o token interno', async () => {
    const { impl, calls } = fakeFetch(async () =>
      Response.json({ resultado: { isFood: true }, modelo: 'clip', versao: 'v1', processamentoMs: 10 }),
    );
    const client = new PythonVisionClient('http://ia:8000', 'token-interno', 5000, impl);

    const res = await client.analyze({ image: IMAGE, mediaType: 'image/jpeg', userHint: 'tinha molho' });

    expect(res).toEqual({ resultado: { isFood: true }, modelo: 'clip', versao: 'v1' });
    const { url, init } = calls[0]!;
    expect(url.toString()).toBe('http://ia:8000/analisar');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-internal-token']).toBe('token-interno');
    const form = init.body as FormData;
    const foto = form.get('foto') as Blob;
    expect(foto.type).toBe('image/jpeg');
    expect(Buffer.from(await foto.arrayBuffer())).toEqual(IMAGE);
    expect(form.get('dica')).toBe('tinha molho');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [422, 'rejected_image'],
    [413, 'rejected_image'],
    [401, 'unavailable'],
    [500, 'unavailable'],
  ])('status %i do servico -> %s', async (status, kind) => {
    const { impl } = fakeFetch(async () => new Response('{}', { status }));
    const error = await new PythonVisionClient('http://ia:8000', 't', 5000, impl)
      .analyze({ image: IMAGE, mediaType: 'image/jpeg' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VisionError);
    expect((error as VisionError).kind).toBe(kind);
  });

  it('timeout -> timeout; rede fora -> unavailable', async () => {
    const timeout = fakeFetch(async () => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    await expect(
      new PythonVisionClient('http://ia:8000', 't', 5000, timeout.impl).analyze({ image: IMAGE, mediaType: 'image/png' }),
    ).rejects.toMatchObject({ kind: 'timeout' });

    const down = fakeFetch(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(
      new PythonVisionClient('http://ia:8000', 't', 5000, down.impl).analyze({ image: IMAGE, mediaType: 'image/png' }),
    ).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('resposta fora do envelope -> bad_response', async () => {
    const { impl } = fakeFetch(async () => Response.json({ algo: 'diferente' }));
    await expect(
      new PythonVisionClient('http://ia:8000', 't', 5000, impl).analyze({ image: IMAGE, mediaType: 'image/png' }),
    ).rejects.toMatchObject({ kind: 'bad_response' });
  });

  it('isHealthy: true com 200, false com erro ou rede fora', async () => {
    const ok = fakeFetch(async () => Response.json({ status: 'ok' }));
    expect(await new PythonVisionClient('http://ia:8000', 't', 5000, ok.impl).isHealthy()).toBe(true);
    expect(ok.calls[0]!.url.toString()).toBe('http://ia:8000/health');
    const down = fakeFetch(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await new PythonVisionClient('http://ia:8000', 't', 5000, down.impl).isHealthy()).toBe(false);
  });
});
