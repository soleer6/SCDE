# AGENTS.md — rules for any coding agent in this repo

This repo is the frontend of SCDE (React + Vite). Two agents work in parallel on
separate git worktrees/branches; Claude Code is the final auditor.

1. Read before coding: `docs/frontend/STYLE_GUIDE.md`, `.claude/skills/scde-frontend/SKILL.md`,
   `docs/frontend/ARCHITECTURE.md`, `docs/frontend/API_INVENTORY.md`.
   If you are Codex, your task is `docs/coordination/CODEX_BRIEF.md`.
2. Only modify paths you own (`docs/coordination/OWNERSHIP.json`). Shared base files
   are frozen; request changes in `docs/coordination/REQUESTS.md`.
3. Never invent endpoints/fields: use only `docs/frontend/API_INVENTORY.md`.
4. Every endpoint used needs a mock handler returning the exact OpenAPI shape.
5. Before each commit: `npm run check` and `npm run audit:ownership`.
6. Git: no push, no force, no rebase/merge of other branches, no history rewrite.
   Spanish conventional commit messages, no mention of AI tools.
7. Log decisions, errors and fixes in your log (`docs/coordination/codex-log.md` for Codex).
