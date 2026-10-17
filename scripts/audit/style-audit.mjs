#!/usr/bin/env node
/* Deterministic style audit (no LLM). Enforces docs/frontend/STYLE_GUIDE.md rules
 * that can be checked mechanically. Usage:
 *   node scripts/audit/style-audit.mjs [dir=src/features]
 * Exit 1 on errors; warnings are informative.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] || 'src/features';
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|css)$/.test(n) && !/\.test\.jsx?$/.test(n) && !/mocks?\.js$/.test(n)) files.push(p);
  }
})(root);

const RULES = [
  // [id, severity, appliesTo regex on filename, regex on line, message]
  ['raw-color', 'error', /\.(css|jsx)$/, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'Raw colour — use a token from src/styles/tokens.css'],
  ['font-family', 'error', /\.(css|jsx)$/, /font-family\s*:(?!\s*var\(--(sans|mono|serif)\))|fontFamily\s*:/, 'Fonts only via var(--sans) / var(--serif) / var(--mono)'],
  ['radius', 'error', /\.(css|jsx)$/, /border-radius\s*:(?!\s*(var\(--radius(-sm|-pill)?\)|0\b|0 var\(--radius|50%|inherit|2px))|borderRadius/, 'Radius only via var(--radius) / var(--radius-sm) / var(--radius-pill)'],
  ['shadow', 'error', /\.(css|jsx)$/, /box-shadow\s*:(?!\s*(none|var\(--shadow-sheet\)|0 0 0 [123]px var\(--))|boxShadow/, 'Shadows only var(--shadow-sheet) or focus rings (0 0 0 Npx var(--token))'],
  ['uppercase', 'warn', /\.(css|jsx)$/, /text-transform\s*:\s*uppercase|textTransform/, 'Sentence case: no forced uppercase (educational direction v2)'],
  ['legacy-token', 'warn', /\.(css|jsx)$/, /var\(--gold/, 'Legacy token --gold*: use --accent* (pending/attention: --amber*)'],
  ['gradient-deco', 'warn', /\.css$/, /linear-gradient|radial-gradient/, 'Gradients only for functional backgrounds / masks; check intent'],
  ['inline-style', 'warn', /\.jsx$/, /style=\{\{/, 'Inline style — prefer a class; allowed for dynamic geometry only'],
  ['px-font', 'warn', /\.css$/, /font-size\s*:\s*\d+px/, 'Font size in px — use --fs-* tokens'],
  ['ui-restyle', 'error', /\.css$/, /^\s*\.ui-[a-z]/, 'Do not restyle shared .ui-* classes inside a feature'],
  ['hardcoded-copy', 'warn', /\.jsx$/, />\s*[A-ZÁÉÍÓÚ][a-záéíóúñ]+(\s+[a-záéíóúñ]+){2,}\s*</, 'Visible copy not translated — use t()'],
  ['legacy-import', 'error', /\.jsx?$/, /from ['"](\.\.\/)+(services|api|context|pages|components)\//, 'Import from removed legacy layers'],
];

let errors = 0;
let warns = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/audit-ignore/.test(line)) return;
    for (const [id, sev, fileRe, re, msg] of RULES) {
      if (!fileRe.test(f) || !re.test(line)) continue;
      const tag = sev === 'error' ? 'ERROR' : 'warn ';
      console.log(`${tag} ${relative('.', f)}:${i + 1} [${id}] ${msg}\n        ${line.trim().slice(0, 120)}`);
      sev === 'error' ? errors++ : warns++;
    }
  });
}
console.log(`\nStyle audit: ${files.length} files, ${errors} errors, ${warns} warnings`);
process.exit(errors ? 1 : 0);
