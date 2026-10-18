import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Verificacion anonima de rutas SPA y bytes del artefacto, sin omitir TLS.
const [baseUrl, outputPath] = process.argv.slice(2);
if (!baseUrl || !outputPath) throw new Error('Uso: node verify-deployment.mjs URL DIRECTORIO');
const base = new URL(baseUrl);
if (base.protocol !== 'https:') throw new Error('La URL publica debe usar HTTPS.');
const localIndex = await readFile(join(outputPath, 'index.html'), 'utf8');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function get(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000) });
  if (response.redirected) throw new Error(`${path}: redireccion inesperada fuera del artefacto publico.`);
  if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
for (const route of ['/', '/admin/users', '/notifications', '/profile']) {
  const html = (await get(route)).toString('utf8');
  if (!/<div\s+id="root"/.test(html) || html !== localIndex) {
    throw new Error(`${route}: el HTML publico no coincide con el artefacto.`);
  }
}
const assets = [...localIndex.matchAll(/(?:href|src)="(\/assets\/[^"?#]+\.(?:css|js))"/g)].map(match => match[1]);
if (!assets.some(path => path.endsWith('.css')) || !assets.some(path => path.endsWith('.js'))) {
  throw new Error('Faltan entradas CSS o JavaScript en el artefacto.');
}
for (const path of [...new Set(assets), '/demo-source.json']) {
  const local = await readFile(join(outputPath, path.slice(1)));
  if (digest(await get(path)) !== digest(local)) throw new Error(`${path}: bytes publicados distintos.`);
}
const source = JSON.parse((await readFile(join(outputPath, 'demo-source.json'), 'utf8')).replace(/^\uFEFF/, ''));
console.log(`PUBLICADO: ${base.origin} · claude ${source.claude} + codex ${source.codex}`);
