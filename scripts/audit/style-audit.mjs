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
  ['font-family', 'error', /\.(css|jsx)$/, /font-family\s*:(?!\s*var\(--(mono|serif)\))|fontFamily\s*:/, 'Fonts only via var(--mono) / var(--serif)'],
  ['radius', 'error', /\.(css|jsx)$/, /border-radius\s*:\s*(?!var\(--radius\)|0\b)|borderRadius/, 'Rounded corners are not part of the language (radius: 0)'],
  ['shadow', 'error', /\.(css|jsx)$/, /box-shadow\s*:(?!\s*none)|boxShadow/, 'No shadows — use hairlines (1px var(--line))'],
  ['gradient-deco', 'warn', /\.css$/, /linear-gradient|radial-gradient/, 'Gradients only for grid backgrounds / masks; check intent'],
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
