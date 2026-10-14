#!/usr/bin/env node
/**
 * Servico de IA (apps/ia) sem decorar comandos de Python - igual em Linux,
 * macOS e Windows.
 *
 *   node scripts/ia.mjs setup   -> cria apps/ia/.venv e instala tudo (torch CPU incluso)
 *   node scripts/ia.mjs dev     -> sobe a IA em http://127.0.0.1:8000
 *   node scripts/ia.mjs test    -> roda os testes do servico de IA
 *
 * Atalhos na raiz: npm run setup:ia | dev:ia | test:ia
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const IA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'ia');
const IS_WINDOWS = process.platform === 'win32';
const VENV_PYTHON = IS_WINDOWS ? join(IA_DIR, '.venv', 'Scripts', 'python.exe') : join(IA_DIR, '.venv', 'bin', 'python');
const TORCH = 'torch==2.14.1';
const TORCH_INDEX = 'https://download.pytorch.org/whl/cpu';
const MIN_PYTHON = [3, 10];

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: IA_DIR, stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
}

/** Primeiro Python 3.10+ encontrado no PATH. */
function findPython() {
  const candidates = IS_WINDOWS ? [['py', ['-3']], ['python', []]] : [['python3', []], ['python', []]];
  for (const [cmd, pre] of candidates) {
    const res = spawnSync(cmd, [...pre, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' });
    if (res.status !== 0 || !res.stdout) continue;
    const [major, minor] = res.stdout.trim().split('.').map(Number);
    if (major > MIN_PYTHON[0] || (major === MIN_PYTHON[0] && minor >= MIN_PYTHON[1])) {
      return { cmd, pre, version: res.stdout.trim() };
    }
    console.warn(`Ignorando ${cmd} ${res.stdout.trim()} (precisa de ${MIN_PYTHON.join('.')}+).`);
  }
  console.error(`Python ${MIN_PYTHON.join('.')}+ nao encontrado. Instale o Python 3.12 (veja o README, secao Pre-requisitos).`);
  process.exit(1);
}

function requireVenv() {
  if (!existsSync(VENV_PYTHON)) {
    console.error('Ambiente Python nao encontrado. Rode antes: npm run setup:ia');
    process.exit(1);
  }
}

const command = process.argv[2];

if (command === 'setup') {
  if (!existsSync(VENV_PYTHON)) {
    const py = findPython();
    console.log(`> Criando apps/ia/.venv com Python ${py.version}...`);
    run(py.cmd, [...py.pre, '-m', 'venv', '.venv']);
  } else {
    console.log('> apps/ia/.venv ja existe, reaproveitando.');
  }
  console.log('> Atualizando pip...');
  run(VENV_PYTHON, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  console.log(`> Instalando PyTorch (versao CPU, ~200 MB)...`);
  run(VENV_PYTHON, ['-m', 'pip', 'install', '--index-url', TORCH_INDEX, TORCH]);
  console.log('> Instalando FastAPI, transformers e demais dependencias...');
  run(VENV_PYTHON, ['-m', 'pip', 'install', '-r', 'requirements-dev.txt']);
  console.log('\nOK: servico de IA instalado. Para subir: npm run dev:ia');
} else if (command === 'dev') {
  requireVenv();
  if (!existsSync(join(IA_DIR, '.env'))) {
    console.error('apps/ia/.env nao existe. Rode antes: npm run setup:env');
    process.exit(1);
  }
  console.log('> Subindo a IA em http://127.0.0.1:8000 (o 1o start baixa o modelo CLIP e demora alguns minutos)...');
  run(VENV_PYTHON, ['-m', 'uvicorn', 'app.main:app', '--env-file', '.env', '--host', '127.0.0.1', '--port', '8000']);
} else if (command === 'test') {
  requireVenv();
  run(VENV_PYTHON, ['-m', 'pytest', '-q']);
} else {
  console.error('Uso: node scripts/ia.mjs <setup|dev|test>');
  process.exit(1);
}
