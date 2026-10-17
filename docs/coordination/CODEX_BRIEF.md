# Codex brief — SCDE frontend, line "admin-ops"

You are one of two agents building the new SCDE frontend in parallel. Claude Code
builds the core grading flows on another branch and is also the **final auditor**:
your branch will be reviewed for style, contract fidelity and ownership before it is
merged. Work autonomously; do not ask for confirmation on minor decisions — decide,
then log the decision in `docs/coordination/codex-log.md`.

## Where you work
- Worktree: `C:\Users\aleja\dev\SCDE-codex`
- Branch: `codex/admin-ops` (already checked out, created from `frontend/base-v2`)
- Never `git push`, never rebase/merge other branches, never touch `C:\Users\aleja\dev\SCDE-claude`
  or `C:\Users\aleja\dev\SCDE`. Commit small, in Spanish, conventional style
  (`feat(admin): …`), with no mention of AI tools in messages. Commits are authored with the repo's git config.

## Project context (read first, in this order)
1. `AGENTS.md` (rules) · 2. `docs/frontend/STYLE_GUIDE.md` (binding visual language)
3. `.claude/skills/scde-frontend/SKILL.md` (how to build a feature + self-critique)
4. `docs/frontend/ARCHITECTURE.md` · 5. `docs/frontend/API_INVENTORY.md` (the ONLY
   valid endpoints/fields, generated from the backend OpenAPI)
6. Look at `src/features/auth/` as the reference implementation of a feature.

SCDE = digital exam grading system (UAM TFG). Backend: Django REST (`/api/v1`),
JWT, multi-tenant organizations, per-subject roles. Frontend: React 19 + Vite, JS,
react-router 7, react-i18next, no CSS framework (tokens + primitives).

## Your scope: management & account features
Create these feature folders (auto-discovered, no shared file needs editing):

### P0 — must finish
1. **`src/features/admin/`** — organization management, `guard: 'staff'`, nav section `manage`.
   - Users: paginated table (`GET /users/` with `page`, `search` and filters available in
     the inventory), create (`POST /users/`), edit (`PATCH /users/{id}/`), reset password
     (`POST /users/{id}/reset-password/`), activate/deactivate if supported by PATCH fields.
     Field-level validation errors shown under each field (`ApiError.fieldCode`).
   - Courses: list/create/edit (`/courses/`, `/courses/{id}/`, `/courses/current/`).
     Only one active course matters to the rest of the app — make it obvious.
   - Org config: form over `GET/PATCH /config/`.
2. **`src/features/subject-admin/`** — per-subject administration, `guard: 'auth'`,
   for users whose membership allows it (`can_manage_members`, `can_manage_groups`,
   `can_delegate_perms`) or staff. Route `/subjects/:subjectId/manage` with tabs:
   members (`/subjects/{id}/members/` list/assign/remove), groups (CRUD), and member
   permission overrides (`/memberships/{id}/permissions/` GET/PATCH, show effective
   permissions vs role defaults from `src/lib/permissions.js`).
   Note: Claude owns `/subjects/:subjectId` (subject page); you own only `/manage`.
   Add a nav entry only for staff (`/admin/subjects` list of all subjects via
   `GET /search/` or `/subjects/export/` — check the inventory; pick what exists).
3. **`src/features/notifications/`** — `GET /notifications/` (paginated),
   `GET /notifications/count/`, `PATCH /notifications/read/`. Page `/notifications`
   (nav section `account`) + a `slots: { 'topbar.end': NotificationsBell }` component
   showing the unread count (poll every 60s, stop when tab hidden).
4. **`src/features/profile/`** — `GET/PATCH /profile/` (email notifications toggle,
   allowed fields only). Page `/profile`, nav section `account`.

### P1 — if time remains
5. Users & subjects import/export (`/users/import/`, `/users/export/`,
   `/subjects/import/`, `/subjects/export/`) with a result summary (created/errors).
6. Audit log viewer `/admin/audit` (`GET /audit-logs/`, paginated, filters available).
7. Tests (Vitest + Testing Library) for each feature's main page in mock mode.

## Mocks (required for every endpoint you use)
Your `mocks.js` handlers return exactly the OpenAPI response shapes. The seed already
contains users, courses, subjects, groups, memberships, notifications, org_config,
audit_logs (see `src/lib/mock/db.js` and the `q` helpers). Need more rows? Use
`extendSeed(fn)` from your folder. Demo accounts: `admin@uam.es / admin123` (staff),
`maria.perez@uam.es / prof123` (coordinator MAT101), `javier.ruiz@uam.es / prof123`,
`elena.rodriguez@estudiante.uam.es / est123`.

## You MUST NOT modify (frozen shared base)
`src/ui/**`, `src/styles/**`, `src/lib/**`, `src/app/**`, `src/main.jsx`,
`package.json`, lockfile, configs, `index.html`, `AGENTS.md`, `CLAUDE.md`,
`docs/frontend/**`, `scripts/**`, `.claude/**`, and Claude's features
(`auth`, `workspace`, `exams`, `grading`, `results`, `reviews`).
If you need a change there (a new primitive, a shared helper, a dependency, a missing
backend field), append it to `docs/coordination/REQUESTS.md` and work around it
locally inside your feature (e.g. a feature-local component). Do not install packages.

## Commands (run from the worktree)
```
npm install          # once
npm run dev          # http://localhost:5173 (mock mode via .env.development)
npm run lint
npm run test
npm run build
npm run audit:style      # style rules, must be 0 errors
npm run audit:ownership  # must pass: only your paths changed
npm run check            # lint + test + build + style audit
```

## Definition of done
- P0 features work end to end in mock mode with the relevant demo accounts, including
  loading / empty / error / permission-denied states.
- `npm run check` and `npm run audit:ownership` pass.
- All copy in ES and EN; no raw colours/radius/shadows; no restyled `.ui-*`.
- `docs/coordination/codex-log.md` updated: what you built, decisions, problems found,
  how you fixed them, commands run and their results, open requests. (This log feeds
  the TFG documentation: be factual, include errors and iterations.)
- Final commit on `codex/admin-ops`. Stop there; do not merge.
