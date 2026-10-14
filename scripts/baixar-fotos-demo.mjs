#!/usr/bin/env node
/**
 * Baixa fotos de exemplo (licenca livre, Wikimedia Commons) para demo/fotos/
 * e escreve os creditos em demo/fotos/CREDITOS.md.
 *
 * Uso: npm run demo:fotos   (so precisa de internet uma vez)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'fotos');
const UA = 'NutriSnap-demo/1.0 (projeto academico)';

/** [arquivo local, titulo no Commons, o que se espera da IA] */
const FOTOS = [
  ['1-banana.jpg', 'File:Cavendish banana from Maracaibo.jpg', 'banana'],
  ['2-batata-frita.jpg', 'File:Cajun fries from Popeyes Louisiana Kitchen, Stratford, Ontario, 2025-08-04.jpg', 'batata frita (com aviso de calorias ocultas)'],
  ['3-espaguete.jpg', 'File:Spaghetti Bolognese - Figaros, Brighton 2023-10-06.jpg', 'macarrao cozido'],
  ['4-teclado.jpg', 'File:Camera zoom burst on a Microsoft computer keyboard in Tuntorp 8.jpg', 'rejeitada (nao e comida)'],
];

const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, '').trim();

mkdirSync(OUT, { recursive: true });
const credits = [
  '# Fotos de demonstracao',
  '',
  'Baixadas do Wikimedia Commons por `npm run demo:fotos`. Uso sob as licencas abaixo (atribuicao obrigatoria).',
  '',
  '| Arquivo | Resultado esperado da IA | Autor | Licenca | Fonte |',
  '|---|---|---|---|---|',
];

for (const [file, title, expected] of FOTOS) {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo' +
    `&iiprop=url|extmetadata&iiurlwidth=800&titles=${encodeURIComponent(title)}`;
  const meta = await fetch(api, { headers: { 'user-agent': UA } }).then((r) => r.json());
  const page = Object.values(meta.query.pages)[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) {
    console.error(`Nao encontrei "${title}" no Wikimedia Commons.`);
    process.exit(1);
  }
  const img = await fetch(ii.thumburl ?? ii.url, { headers: { 'user-agent': UA } });
  if (!img.ok) {
    console.error(`Falha ao baixar ${file} (HTTP ${img.status}).`);
    process.exit(1);
  }
  const bytes = Buffer.from(await img.arrayBuffer());
  if (bytes.length < 1000) {
    console.error(`Download de ${file} veio vazio/incompleto (${bytes.length} bytes). Tente de novo.`);
    process.exit(1);
  }
  writeFileSync(join(OUT, file), bytes);
  const md = ii.extmetadata ?? {};
  credits.push(
    `| ${file} | ${expected} | ${strip(md.Artist?.value) || '?'} | ${strip(md.LicenseShortName?.value) || '?'} | ${ii.descriptionurl} |`,
  );
  console.log(`OK  demo/fotos/${file}`);
}

writeFileSync(join(OUT, 'CREDITOS.md'), credits.join('\n') + '\n');
console.log('OK  demo/fotos/CREDITOS.md');
