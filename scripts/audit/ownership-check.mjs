#!/usr/bin/env node
/* Deterministic ownership check (no LLM needed).
 * Usage: node scripts/audit/ownership-check.mjs [agent] [ref]
 *   agent: claude | codex   (default: inferred from current branch)
 *   ref:   branch/commit to inspect (default: HEAD)
 * Compares `git diff --name-only <base>...<ref>` (plus staged, unstaged and untracked
 * files when ref is HEAD) against docs/coordination/OWNERSHIP.json.
 * Exit 1 if the agent touched files outside its paths (shared files included).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../../docs/coordination/OWNERSHIP.json', import.meta.url), 'utf8'));
const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();

const ref = process.argv[3] || 'HEAD';
const branch = ref === 'HEAD' ? sh('git rev-parse --abbrev-ref HEAD') : ref;
const agent = process.argv[2] || Object.keys(cfg.agents).find((a) => cfg.agents[a].branch === branch);
if (!agent || !cfg.agents[agent]) {
  console.error(`Unknown agent for branch "${branch}". Pass it explicitly: claude | codex`);
  process.exit(2);
}

const toRegex = (glob) =>
  new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*') + '$');
const ownList = cfg.agents[agent].paths.flatMap((p) => (p === '<shared>' ? cfg.shared : [p]));
const own = ownList.map(toRegex);
const shared = cfg.shared.map(toRegex);

const lines = (out) => out.split('\n').map((s) => s.trim()).filter(Boolean);
const committed = lines(sh(`git diff --name-only ${cfg.base}...${ref}`));
// On HEAD also inspect the working tree: staged, unstaged and untracked files,
// so a change is caught before it is committed.
const local =
  ref === 'HEAD'
    ? [
        ...lines(sh('git diff --name-only --cached')),
        ...lines(sh('git diff --name-only')),
        ...lines(sh('git ls-files --others --exclude-standard')),
      ]
    : [];
const changed = [...new Set([...committed, ...local])];
const violations = [];
const sharedTouched = [];
for (const f of changed) {
  if (own.some((r) => r.test(f))) continue;
  (shared.some((r) => r.test(f)) ? sharedTouched : violations).push(f);
}

console.log(`Ownership check — agent=${agent} ref=${ref} base=${cfg.base}`);
console.log(`  changed files: ${changed.length} (${committed.length} committed, ${local.length} local entries)`);
if (sharedTouched.length) {
  console.log(`\n  ✗ SHARED (frozen) files modified — must go through REQUESTS.md:`);
  sharedTouched.forEach((f) => console.log(`    ${f}`));
}
if (violations.length) {
  console.log(`\n  ✗ Files outside ${agent}'s ownership:`);
  violations.forEach((f) => console.log(`    ${f}`));
}
if (!sharedTouched.length && !violations.length) console.log('  ✓ all changes inside owned paths');
process.exit(sharedTouched.length || violations.length ? 1 : 0);
