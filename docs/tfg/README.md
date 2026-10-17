# Registro técnico para la memoria del TFG

Registro factual del proceso de construcción del frontend v2 de SCDE (octubre 2026),
pensado como materia prima para redactar la memoria. No es texto de memoria.

| Documento | Contenido |
|---|---|
| [01-analysis.md](01-analysis.md) | Cómo se analizó el repositorio y el backend; qué se infirió y qué no |
| [02-architecture-decisions.md](02-architecture-decisions.md) | Decisiones de arquitectura (formato ADR breve) |
| [03-backend-gaps.md](03-backend-gaps.md) | Huecos del contrato backend detectados y preguntas abiertas |
| [04-iterations.md](04-iterations.md) | Errores, cómo se detectaron, cómo se corrigieron; comandos |
| [05-parallel-workflow.md](05-parallel-workflow.md) | Trabajo en paralelo Claude Code + Codex y auditoría |
| [agentic-generalization-notes.md](agentic-generalization-notes.md) | Qué partes del proceso podrían convertirse en un sistema genérico backend → frontend |

Ramas: `frontend/base-v2` (base común), `claude/core-flows`, `codex/admin-ops`,
`preview/integration` (temporal, solo para ver ambas partes juntas).
Versión previa conservada en `legacy/modulo-profesor-v1`.
