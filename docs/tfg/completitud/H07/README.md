# H07 — bandeja de revisiones con el backend real (RF-12.6/12.7)

Con el contrato #14 (`669d9b2`), `GET /my-tasks/` incluye las solicitudes
pendientes de los exámenes donde el usuario tiene `can_manage_reviews`, sin
necesidad de `AssignmentRule`. `ReviewsPage` ya consumía esa lista.

Verificado (Edge headless + Vite real + Django real) en una organización
sintética nueva (`bootstrap_h07.py`, ventana de revisión abierta): el alumno
envía una solicitud; el gestor de la organización, sin regla de asignación,
la ve en `/reviews`, responde y resuelve (PATCH 200); el alumno la ve resuelta
con el mensaje y tras recargar desaparece de la bandeja (`inbox-real.mjs`,
captura `h07-inbox-real.png`). También la ve el docente asignado.

Límite: el actor es el gestor (`is_staff`), no un usuario con rol COORDINATOR de
asignatura sin regla; ese caso concreto lo cubren las 28 pruebas HTTP del backend.
Credenciales solo en `%LOCALAPPDATA%/SCDE/integration/fixtures-claude-h07.local.json`.
