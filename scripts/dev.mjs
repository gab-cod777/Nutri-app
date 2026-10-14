#!/usr/bin/env node
/**
 * Sobe tudo em UM terminal: IA (Python) + API (Node) e, quando a API estiver
 * pronta, o app (Expo, com QR code). Ctrl+C encerra tudo.
 *
 * Pre-requisito: banco no ar (npm run db:up) e npm run setup:env / setup:ia ja feitos.
 * Uso: npm run dev
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const children = [];

function start(name, command, args, { inherit = false } = {}) {
  const child = spawn(command, args, {
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  children.push(child);
  if (!inherit) {
    const prefix = `[${name}] `;
    const pipe = (stream, out) =>
      stream.on('data', (chunk) => {
        for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) out.write(prefix + line + '\n');
      });
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
  }
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`${`[${name}]`} terminou com codigo ${code}`);
  });
  return child;
}

function stopAll() {
  for (const child of children) child.kill('SIGINT');
}
process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

/** IPs da maquina na rede local (o celular usa um destes). */
function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
    .filter((ip) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) && !ip.startsWith('172.17.'));
}

async function waitForApi(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://localhost:3333/health');
      last = await res.json();
      if (res.ok) return last;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return last;
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
start('ia', 'node', ['scripts/ia.mjs', 'dev']);
start('api', npm, ['run', 'dev:api']);

console.log('\n> Subindo IA e API (o 1o start da IA baixa o modelo e pode levar 1-2 min)...\n');
const health = await waitForApi(5 * 60_000);
if (!health || health.status !== 'ok') {
  console.error('\n> A API nao ficou pronta:', JSON.stringify(health));
  console.error('> Banco no ar? (npm run db:up)  .env criados? (npm run setup:env)');
  stopAll();
  process.exit(1);
}

console.log('\n> API pronta: banco ok, IA ok.');
for (const ip of lanAddresses()) {
  console.log(`> Teste no NAVEGADOR DO CELULAR: http://${ip}:3333/health`);
}
console.log('> Abrindo o Expo. Escaneie o QR code com o Expo Go (celular na mesma rede Wi-Fi).\n');
start('app', npm, ['run', 'dev:mobile'], { inherit: true });
