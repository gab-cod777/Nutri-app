#!/usr/bin/env node
/**
 * Cria apps/api/.env e apps/ia/.env a partir dos .env.example, com segredos
 * aleatorios. O IA_INTERNAL_TOKEN sai IGUAL nos dois arquivos (se forem
 * diferentes, a API nao consegue falar com a IA).
 *
 * Nunca sobrescreve um .env existente.
 *
 * Uso: npm run setup:env
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiEnv = join(root, 'apps/api/.env');
const iaEnv = join(root, 'apps/ia/.env');

const secret = (bytes) => randomBytes(bytes).toString('base64url');

function setVar(text, name, value) {
  const line = new RegExp(`^${name}=.*$`, 'm');
  if (!line.test(text)) throw new Error(`${name} nao encontrada no .env.example`);
  return text.replace(line, `${name}="${value}"`);
}

const apiExists = existsSync(apiEnv);
const iaExists = existsSync(iaEnv);

if (apiExists && iaExists) {
  console.log('OK: apps/api/.env e apps/ia/.env ja existem. Nada foi alterado.');
  process.exit(0);
}
if (apiExists !== iaExists) {
  const existing = apiExists ? 'apps/api/.env' : 'apps/ia/.env';
  const missing = apiExists ? 'apps/ia/.env' : 'apps/api/.env';
  console.error(`ATENCAO: ${existing} existe mas ${missing} nao.`);
  console.error(`Crie ${missing} copiando o .env.example e use o MESMO IA_INTERNAL_TOKEN do outro arquivo,`);
  console.error('ou apague os dois .env e rode este comando de novo.');
  process.exit(1);
}

const token = secret(32);
let api = readFileSync(join(root, 'apps/api/.env.example'), 'utf8');
api = setVar(api, 'JWT_SECRET', secret(48));
api = setVar(api, 'IA_INTERNAL_TOKEN', token);
writeFileSync(apiEnv, api);

let ia = readFileSync(join(root, 'apps/ia/.env.example'), 'utf8');
ia = setVar(ia, 'IA_INTERNAL_TOKEN', token);
writeFileSync(iaEnv, ia);

console.log('Criados:');
console.log('  apps/api/.env  (JWT_SECRET e IA_INTERNAL_TOKEN aleatorios)');
console.log('  apps/ia/.env   (mesmo IA_INTERNAL_TOKEN da API)');
console.log('O banco ja aponta para o Postgres do docker-compose (localhost:5432, usuario/senha postgres, banco nutrisnap).');
