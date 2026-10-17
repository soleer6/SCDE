---
name: scde-frontend
description: Build or modify any UI in the SCDE frontend (React + Vite) following its fixed minimal, light, educational visual language (v2) and feature-module architecture. Use before writing any page, component, CSS or mock handler in this repo.
---

# SCDE frontend skill

Adapted from Anthropic's `frontend-design` skill (anthropics/skills). The upstream
skill asks the designer to choose a distinctive direction; **here the direction is
fixed by the client**: minimal and educational (a calm, light, Moodle-like study
tool done with restraint). A first dark/gold/monospace version copied the client's
reference site too literally and was rejected — references inform one axis
(minimalism), not the palette. This skill keeps the upstream discipline (restraint,
intentional structure, copy quality, self-critique) and pins the aesthetic.

## Before writing code
1. Read `docs/frontend/STYLE_GUIDE.md` (binding) and `docs/frontend/ARCHITECTURE.md`.
2. Verify every endpoint/field you use in `docs/frontend/API_INVENTORY.md`
   (generated from the backend OpenAPI). Never invent endpoints or fields.
3. Check `docs/coordination/OWNERSHIP.json`: only edit paths you own.

## How to build a feature
- One folder `src/features/<id>/` with `index.jsx` exporting
  `{ id, order, routes, nav, mocks, i18n, slots }`. It is auto-discovered.
- `api.js`: thin functions over `api` from `src/lib/api/client.js`, returning
  backend shapes (snake_case). Map to view models in the component or a `model.js`.
- `mocks.js`: handlers for the endpoints this feature owns, returning EXACTLY the
  OpenAPI response shape. Read/write `db` (src/lib/mock/db.js); add seed rows with
  `extendSeed` from your own folder, never edit db.js.
- `i18n`: ES + EN dictionaries in the feature (`<id>` namespace).
- UI: compose `src/ui` primitives. Feature CSS file with its own prefix.

## Design discipline (from upstream, kept)
- Spend boldness in one place per screen: usually the key number (grade, pending
  count) set in large serif. Everything else quiet.
- Think of the audience: a teacher with 120 exams to grade and a nervous student
  checking a grade. Legibility and calm over spectacle; sentence case, no shouting.
- Structure is information: borders, numbering, eyebrows only when they encode
  something true (a real sequence, real context).
- Motion only answers user actions. One loader style.
- Copy from the user's perspective, active verbs, the same action name across the
  flow (button "Publicar" → toast "Publicado"). Errors say what happened and how to
  fix it; empty states invite the next action.
- Quality floor without announcing it: keyboard focus, labels, mobile ≥ 360px,
  reduced motion.

## Self-critique checklist (run before every commit)
- [ ] `npm run check` passes (lint, tests, build, style audit).
- [ ] `npm run audit:ownership` passes.
- [ ] No raw colours; radius/shadows only via tokens; no uppercase; no restyled `.ui-*`.
- [ ] Every string translated ES/EN.
- [ ] Loading, empty, error and permission-denied states exist for every data view.
- [ ] Works in mock mode with every demo account that can reach the view.
- [ ] "Remove one accessory": delete one decorative element you added.
