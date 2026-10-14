import { z } from 'zod';
import { unprocessable } from './errors.js';

/**
 * Cursores opacos (base64url de JSON). O cliente so devolve o que recebeu;
 * cursor adulterado vira 422, nunca um erro de banco.
 */
export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor<T>(cursor: string | undefined, schema: z.ZodType<T>): T | null {
  if (!cursor) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;
  } catch {
    // cai no erro abaixo
  }
  throw unprocessable('invalid_cursor', 'Cursor de paginacao invalido.');
}

/** Cursor "keyset" por (instante, id), para listas ordenadas por data desc. */
export const keysetCursorSchema = z.object({ t: z.string().datetime(), id: z.string().uuid() });
export type KeysetCursor = z.infer<typeof keysetCursorSchema>;

/** Cursor por deslocamento, para listas ordenadas por relevancia (busca). */
export const offsetCursorSchema = z.object({ o: z.number().int().min(0).max(10_000) });
