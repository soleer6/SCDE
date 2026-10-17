# Requests to the auditor (shared-file changes, missing backend fields)

Format: `- [agent] [date] what / why / workaround used`

- [claude] [2026-10-17] BASE: el router de mocks elige ahora la ruta más específica (menos parámetros), igual que Django con `<uuid:pk>`. Corrige que `GET /subjects/:id/` (workspace) capturase `GET /subjects/export/` (subject-admin). Detectado al integrar en preview/integration.
- [claude] [2026-10-17] BASE (respuesta a peticiones de codex): Field enlaza hint/error por aria-describedby y marca aria-invalid; Dialog atrapa el foco y traduce Cerrar; Toast traduce Cerrar; AuthProvider expone updateSession(patch) para sincronizar email tras PATCH /profile/; ownership-check incluye cambios preparados, sin preparar y no rastreados; enlace a /subjects/:id/manage ya presente en SubjectPage (según can_manage_members/can_manage_groups o staff).
