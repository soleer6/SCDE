# H04, H05 y H15 con Django real (Edge headless + Vite real + backend de integración)

Cada caso usa una organización sintética nueva (`bootstrap_*.py`, ejecutar con
`manage.py shell` en el contenedor API); credenciales solo en
`%LOCALAPPDATA%/SCDE/integration/fixtures-claude-h0X.local.json`.

- H04 (`h04-real.mjs`): examen con P1 (asignado por regla) y P2 ajeno. El docente
  ve solo P1 (`0/1 problemas`), marca el criterio, queda `1/1` y puede marcar
  como corregido; P2 no aparece. Fuente: `problems_sent` de `/my-tasks/?exam_id=`.
- H05 (`h05-real.mjs`): con `can_download_pages=false` no hay botón; con `true`
  aparece "Descargar PDF" y descarga `<asignatura>-<examen>.pdf`. El permiso se
  restaura al valor original. Nota: con la revisión cerrada y
  `can_view_pages_after_review=false` el PDF no se muestra y por tanto tampoco el botón.
- H15 (`h15-real.mjs`): dos notas GRADED, una con incidencia. Publicar → 1 publicada
  (`PUBLISHED`), 1 sigue `GRADED`; el panel lista la entrega con "tiene incidencias
  sin resolver" y el botón de publicar sigue disponible.
