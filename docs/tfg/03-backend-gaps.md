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

## gap-5 · `POST /orphan-pages/{id}/attach/` falla siempre
- **Evidencia**: `OrphanPageAttachView.post` valida con `AttachPageSerializer` (solo
  define `page_id`, y lo exige) y después lee `serializer.validated_data["instance_id"]`
  (`instances/views/instances.py`), que no existe → `KeyError` → 500. El OpenAPI declara
  `AttachPageRequest {page_id}`, así que ningún cliente puede enviar el destino.
- **Mitigación frontend**: se adjuntan huérfanas con `POST /instances/{id}/pages/attach/
  {page_id}`, que sí es coherente (requiere `can_resolve_issues` en la asignatura).
- **Propuesta**: serializer propio `{instance_id}` para esta vista, o retirarla.

## gap-6 · `MISSING_PAGE` no se limpia nunca
- **Evidencia**: `remove_issue` solo se llama para `STUDENT_NOT_IDENTIFIED` y
  `DUPLICATE_STUDENT` (`update_instance`). `recalculate_issues` recalcula `has_issues` a
  partir de `issue_types` + páginas, pero no toca `issue_types`. Al completar un examen
  moviendo o adjuntando la página que faltaba, pasa a `RECEIVED` pero sigue marcado
  `MISSING_PAGE` y `has_issues = true`.
- **Mitigación**: ninguna posible desde el cliente; la UI muestra la incidencia tal cual
  y el mock reproduce el comportamiento (test en `ingestion.test.jsx`).
- **Propuesta**: en `check_assembling_complete`, `remove_issue(MISSING_PAGE)` al pasar a
  `RECEIVED`, y `recalculate_issues` tras ello.

## gap-7 · Incidencias de escaneo: datos que faltan
- No hay URL para ver la imagen de una página (`PageResponse.storage_ref` es una clave de
  MinIO, sin `download_url`): quien resuelve incidencias no puede ver la hoja que mueve,
  acepta o descarta. Propuesta: `download_url` presignada como en anotaciones.
- `POST /exams/{id}/instances/create/` crea con `expected_pages = 0` y sin comprobar
  estudiante duplicado (a diferencia de `PATCH`): una instancia manual nunca pasa sola a
  `RECEIVED`. La UI permite asignar después el modelo (el `PATCH` recalcula
  `expected_pages`).
- `PageResponse` no incluye `created_at`: la lista de huérfanas no puede mostrar cuándo
  llegó cada hoja (el backend sí la ordena por esa fecha).

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
