import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Hash de senha com scrypt (nativo do Node, resistente a GPU por exigir memoria).
 *
 * Formato armazenado: `scrypt$N$r$p$<salt base64>$<hash base64>`. Os
 * parametros vao junto do hash para podermos endurecer o custo no futuro sem
 * invalidar senhas antigas (`needsRehash`).
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function options(n: number, r: number, p: number): ScryptOptions {
  // maxmem precisa comportar 128 * N * r bytes.
  return { N: n, r, p, maxmem: 256 * n * r };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options(N, R, P));
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, options(Number(n), Number(r), Number(p)));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * Hash ficticio para igualar o tempo de resposta do login quando o e-mail nao
 * existe - sem isso, a latencia revelaria quais e-mails tem conta.
 */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('nutrix-dummy-password');
  await verifyPassword(password, await dummyHash);
  return false;
}
