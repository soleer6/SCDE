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

## H12 (parcial) — exportación CSV y JSON
Hallazgo con el backend real: el frontend enviaba `?format=` y DRF lo interpreta como sufijo de
renderizador (CSV → 404, JSON → devolvía CSV). El parámetro correcto es `export_format`. Corregido en
`exams/api.js` y en el mock; botón nuevo "Exportar JSON". `h12-export-real.mjs` descarga ambos
ficheros con Django real (fixture H15). Pendiente de H12: filtros combinables por alumno/grupo/modelo y búsqueda.

## H16 (parcial) — retrocesos de estado con confirmación
`GradingPage` ofrece según estado: PENDING_GRADING→GRADED, GRADED→PENDING_GRADING, PENDING_REVIEW→GRADED
(marcar corregido tras revisar) y, con diálogo de confirmación que explica que no se borra ninguna
calificación, PUBLISHED→GRADED (retirar publicación) y FINALIZED→PENDING_REVIEW (reabrir revisión), como
`VALID_TRANSITIONS` del backend. `h16-real.mjs`: con Django real, cancelar no cambia nada y confirmar deja
la instancia en GRADED. La eliminación de instancia (RF-7.10) ya existe en `ingestion/InstancePanel`
con confirmación; no se ha ejecutado contra datos reales.
