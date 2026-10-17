# Requests to the auditor (shared-file changes, missing backend fields)

Format: `- [agent] [date] what / why / workaround used`

- [claude] [2026-10-17] BASE: el router de mocks elige ahora la ruta más específica (menos parámetros), igual que Django con `<uuid:pk>`. Corrige que `GET /subjects/:id/` (workspace) capturase `GET /subjects/export/` (subject-admin). Detectado al integrar en preview/integration.
