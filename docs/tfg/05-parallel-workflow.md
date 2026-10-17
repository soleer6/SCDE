# 05 · Trabajo en paralelo: Claude Code + Codex

## Montaje
- `git worktree` por agente sobre el mismo repositorio (sin compartir working directory):
  `SCDE-claude` → `claude/core-flows`, `SCDE-codex` → `codex/admin-ops`, ambos desde
  `frontend/base-v2`. La rama original `modulo-profesor` no se tocó.
- Base común primero (sistema de diseño, cliente API, mocks, registro de features,
  login, docs de coordinación) y después ramificación. Sin esa base, el segundo agente
  no podía arrancar sin pisar ficheros.

## División del trabajo (por áreas funcionales, no 50/50)
| Claude (núcleo + auditor) | Codex (gestión y cuenta) |
|---|---|
| inicio, asignaturas, panel de examen, corrección (PDF + anotaciones + notas), resultado del alumno, revisiones | usuarios, cursos, configuración, auditoría, miembros/grupos/permisos de asignatura, notificaciones, perfil |

Criterio: mínima dependencia. Las áreas de Codex dependen de endpoints que el núcleo
no usa (users, courses, config, memberships, notifications, profile). Punto de contacto
único: la página de asignatura enlaza a `/subjects/:id/manage` (de Codex).

## Mecanismos de coordinación
- `docs/coordination/OWNERSHIP.json`: rutas por agente + rutas compartidas congeladas.
- `scripts/audit/ownership-check.mjs`: comprueba commits y cambios sin commitear.
- `docs/coordination/REQUESTS.md`: peticiones a la base (solo añadir líneas).
- `docs/coordination/codex-log.md`: registro de Codex (decisiones, errores, comandos).
- `AGENTS.md` (Codex lo lee al arrancar) + `CODEX_BRIEF.md` (encargo priorizado P0/P1).
- Skill compartida `.claude/skills/scde-frontend` (adaptada de `frontend-design` de Anthropic).
- Agente `.claude/agents/parallel-auditor.md` (revisión de solo lectura).

## Supervisión realizada
- Lectura de la sesión de Codex (`~/.codex/sessions/.../rollout-*.jsonl`) para confirmar
  worktree, rama y actividad (se detectó una sesión interrumpida por el usuario).
- Auditoría determinista de su rama: propiedad (25 ficheros, todos en sus rutas),
  estilo (0 errores), endpoints usados (28, todos presentes en el inventario).
- Rama temporal `preview/integration` para que el usuario vea ambas partes; ahí se
  detectó el único fallo de integración (iteración 14).

## Observaciones
- El contrato real + la prohibición de inventar hicieron que Codex parase en los huecos
  y los documentara en lugar de improvisar endpoints.
- El sistema de tokens permitió cambiar la estética sin interrumpir a Codex.
- Los conflictos aparecieron solo en documentos compartidos de solo-añadir, nunca en código.
