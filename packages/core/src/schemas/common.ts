import { z } from 'zod';

/**
 * Contratos transversais da API REST: envelope de erro, paginacao e params.
 *
 * Ficam no core para o app tratar erro com o mesmo tipo que o servidor emite.
 */

/** Corpo de toda resposta de erro (4xx/5xx). Ver docs/03-api.md. */
export const apiErrorSchema = z.object({
  error: z.object({
    /** Codigo estavel, legivel por maquina. Ex.: "validation_failed", "not_found". */
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** `:id` em rotas. Id que nao e UUID vira 422 - nunca chega ao banco. */
export const idParamSchema = z.object({ id: z.string().uuid() });
export type IdParam = z.infer<typeof idParamSchema>;

/** Pagina generica com cursor opaco. `nextCursor` nulo = fim da lista. */
export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
