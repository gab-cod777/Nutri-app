import type { Request, RequestHandler, Response, Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';

/**
 * Declaracao de rota com contrato Zod de entrada e saida.
 *
 * - Entrada: `params`, `query` e `body` passam pelo schema antes do handler.
 *   Falha -> ZodError -> 422 no error handler.
 * - Saida: o retorno do handler passa pelo schema de resposta. Isso garante o
 *   contrato com o app E remove campos nao declarados (ex.: `passwordHash`,
 *   `userId`) - nada vaza por acidente de um `select` amplo.
 */

type AnySchema = z.ZodTypeAny;
type Out<S> = S extends AnySchema ? z.output<S> : undefined;

/** Aceita arrays `readonly` no retorno (o dominio do core devolve estruturas imutaveis). */
type ReadonlyTolerant<T> = T extends (infer U)[]
  ? readonly ReadonlyTolerant<U>[]
  : T extends object
    ? { [K in keyof T]: ReadonlyTolerant<T[K]> }
    : T;

export interface RouteContext<P, Q, B> {
  readonly params: P;
  readonly query: Q;
  readonly body: B;
  /** Usuario do token. Vazio em rota publica. */
  readonly userId: string;
  readonly req: Request;
  readonly res: Response;
}

export interface RouteDefinition<
  PS extends AnySchema | undefined,
  QS extends AnySchema | undefined,
  BS extends AnySchema | undefined,
  RS extends AnySchema | null,
> {
  readonly method: 'get' | 'post' | 'put' | 'delete';
  readonly path: string;
  readonly params?: PS;
  readonly query?: QS;
  readonly body?: BS;
  /** Schema da resposta. `null` = sem corpo (204). */
  readonly response: RS;
  readonly status?: number;
  /** Middlewares especificos da rota (rate limit, upload...). Rodam antes do parse. */
  readonly middlewares?: readonly RequestHandler[];
  readonly handler: (
    ctx: RouteContext<Out<PS>, Out<QS>, Out<BS>>,
  ) => Promise<RS extends AnySchema ? ReadonlyTolerant<z.input<RS>> : void>;
}

export function defineRoute<
  PS extends AnySchema | undefined = undefined,
  QS extends AnySchema | undefined = undefined,
  BS extends AnySchema | undefined = undefined,
  RS extends AnySchema | null = null,
>(router: Router, def: RouteDefinition<PS, QS, BS, RS>): void {
  // Express 5 encaminha rejeicoes de handlers async para o error handler.
  router[def.method](def.path, ...(def.middlewares ?? []), async (req: Request, res: Response) => {
    const params = (def.params ? def.params.parse(req.params) : undefined) as Out<PS>;
    const query = (def.query ? def.query.parse(req.query ?? {}) : undefined) as Out<QS>;
    const body = (def.body ? def.body.parse(req.body ?? {}) : undefined) as Out<BS>;

    const result = await def.handler({ params, query, body, userId: req.auth?.userId ?? '', req, res });

    if (def.response === null) {
      res.status(def.status ?? 204).end();
      return;
    }
    const parsed = def.response.safeParse(result);
    if (!parsed.success) {
      req.log.error({ issues: parsed.error.issues, path: def.path }, 'response contract violation');
      throw new AppError(500, 'response_contract_violation', 'Erro interno ao montar a resposta.');
    }
    res.status(def.status ?? 200).json(parsed.data);
  });
}
