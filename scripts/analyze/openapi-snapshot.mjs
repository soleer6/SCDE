/* Writes a trimmed JSON snapshot of the backend OpenAPI contract
 * (operations, parameters, request/response schemas; no prose or examples)
 * to src/test/contract/openapi.json, used by the mock contract test.
 *
 *   node scripts/analyze/openapi-snapshot.mjs [path/to/SCDEE API.yaml]
 *
 * js-yaml comes with eslint; regenerate whenever the backend contract changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';

const src = process.argv[2] ?? 'C:/Users/aleja/dev/SCDEE-backend/docs/files/spectacular/SCDEE API.yaml';
const text = readFileSync(src, 'utf8');
const spec = yaml.load(text);
const DROP = new Set(['description', 'summary', 'example', 'examples', 'title', 'externalDocs', 'tags', 'security']);

/* Keys under `properties` are field names (a field may be called "description"). */
function strip(node, fieldNames = false) {
  if (Array.isArray(node)) return node.map((n) => strip(n));
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([k]) => fieldNames || !DROP.has(k))
      .map(([k, v]) => [k, strip(v, !fieldNames && k === 'properties')]),
  );
}

const snapshot = {
  source: src.split(/[\/]/).slice(-1)[0],
  sha256: createHash('sha256').update(text).digest('hex').slice(0, 12),
  version: spec.info?.version,
  paths: strip(spec.paths),
  schemas: strip(spec.components.schemas),
};
const out = new URL('../../src/test/contract/openapi.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(snapshot)}\n`);
console.log(`openapi.json: ${Object.keys(snapshot.paths).length} paths, ${Object.keys(snapshot.schemas).length} schemas (${snapshot.sha256})`);
