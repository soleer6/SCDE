# SCDE - Sistema de Corrección Digital de Exámenes

TFG (UAM). Frontend React + Vite (este repo) + backend Django REST (repo `anxoCRuam/SCDEE`, rama `backend`; clon local en `C:\Users\aleja\dev\SCDEE-backend`).

## Leer antes de trabajar
- `AGENTS.md` (reglas comunes de agentes), `docs/frontend/STYLE_GUIDE.md`, `.claude/skills/scde-frontend/SKILL.md`
- `docs/frontend/ARCHITECTURE.md`, `docs/frontend/API_INVENTORY.md` (generado del OpenAPI real)
- Coordinación paralela: `docs/coordination/` (OWNERSHIP.json, CODEX_BRIEF.md, REQUESTS.md)
- Registro técnico para la memoria: `docs/tfg/`

## Convenciones críticas
- Campos y valores de API en inglés y tal cual el backend (snake_case); nunca inventar endpoints.
- Roles por asignatura (COORDINATOR/TEACHER/STUDENT); `is_staff` = gestor de organización.
- Coordenadas de anotaciones relativas (0-1).
- Mock: `VITE_MOCK_API=true`; reset de datos con `?resetMock`.

## Git
- Commits firmados con la config del repo, sin mencionar IA en los mensajes.
- Mensajes en español, estilo convencional (feat:, fix:, chore:, refactor:, docs:).
- Nunca push/force/rebase; ramas por agente (ver OWNERSHIP.json).
- La versión anterior del frontend está en el tag `legacy/modulo-profesor-v1` y la rama `modulo-profesor`.
