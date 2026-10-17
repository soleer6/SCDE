# 03 · Huecos del contrato backend y preguntas abiertas

Detectados al convertir el contrato en pantallas. Ninguno se puede resolver solo
desde el frontend; son preguntas para el equipo backend.

## gap-1 · El profesorado no puede leer las notas por problema
- **Evidencia**: `PUT /instances/{id}/problems/{pid}/grade/` exige `old_score`
  (`grading.py`: si existe nota y `old_score` ≠ nota guardada → 409 `VERSION_CONFLICT`;
  enviar `null` también da conflicto). `InstanceResponse` solo incluye `total_score`.
  No hay `GET` de notas para docentes (solo `StudentInstance.grades`, sin `problem_id`).
- **Efecto**: recalificar desde otra sesión o navegador es imposible.
- **Mitigación frontend**: caché local de la última nota guardada por problema
  (`scde.grades.<instanceId>`) + aviso en la UI cuando el total existe pero no se conocen
  las notas parciales.
- **Propuesta**: incluir `grades: [{problem_id, score, grader_email, rubric_selections}]`
  en `InstanceResponse` para usuarios con permiso de corrección, o `GET /instances/{id}/grades/`.

## gap-2 · El alumnado no recibe los ids de los problemas
- **Evidencia**: `POST /instances/{id}/review-requests/` requiere
  `problems: [{problem_id, message}]`. El alumno recibe `ExamBasic` (sin problemas) y
  `StudentInstance.rubric/grades` solo con `problem_name`.
- **Efecto**: un alumno no puede pedir revisión desde ninguna UI.
- **Mitigación**: el frontend usa `problem_id` si viene en `rubric`/`grades`; si no, explica
  por qué no puede reclamar. El mock implementa la propuesta, marcada `PROPOSAL`.
- **Propuesta** (2 líneas en `StudentInstanceSerializer`): añadir `"problem_id": str(p.id)`
  a cada elemento de `rubric` y `grades`.

## gap-3 · Cursos (detectado por Codex)
- No existe `GET /courses/` ni operación para activar un curso (PATCH no admite `is_active`).
  `GET /search/` devuelve `PaginatedCourseList` (posible vía de listado; pendiente de verificar).

## gap-4 · Descubrir la membresía propia (detectado por Codex)
- `MySubject` no incluye `membership_id` ni permisos efectivos. Un usuario con
  `can_delegate_perms` sin `can_manage_members` no puede descubrir ids de membresía.

## Otras observaciones
- `CreateReviewSerializer.notify_students` tiene `default=False`, pero la vista usa
  `get(..., True)`: el valor efectivo depende de si el cliente envía el campo. El frontend
  lo envía siempre explícito.
- `MySubjectsView` busca el curso activo sin filtro explícito de organización, pero
  `AcademicCourse` usa `TenantManager`, que filtra por la organización del request:
  **no hay fuga** (se sospechó y se descartó leyendo `core/models/managers.py`).
- Las URLs presignadas de MinIO (`download_url`) se leen desde el navegador: requieren
  CORS en MinIO para el origen del frontend. Pendiente de probar con backend real.
- No hay nota de aprobado en el modelo; el frontend asume 5/10.
