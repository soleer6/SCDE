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
- **Estado (22/10/2026)**: el backend local `fix/integracion-real` implementa la propuesta
  (`InstanceResponse.grades`, GradeResponse filtrado por problema corregible) pero aún sin
  commit ni regresiones (tarea #1). El frontend ya la consume: las notas del servidor
  tienen prioridad sobre la caché local, `rubric_selections` se lee como lista de ids y,
  tras un 409 `VERSION_CONFLICT`, la página relee la instancia y muestra el valor guardado
  antes de permitir otro intento. La caché local queda solo como reserva para backends sin
  el campo. Validado con Django real en `src/features/grading/real-backend/`
  (navegador limpio, segunda sesión JWT, conflicto y rúbrica); sin revisión visual.

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

## gap-8 · Zonas de reconocimiento: contrato y geometría
- `POST /page-profiles/{id}/zones/` declara en el OpenAPI una respuesta `ZoneResponse`,
  pero la vista serializa con `many=True` y devuelve **una lista** (una zona por página
  cuando se envía `page_numbers`). `CreateZoneSerializer.zone_type` es obligatorio aunque
  el esquema no lo marca como `required`.
- Las coordenadas son **puntos PDF con origen abajo a la izquierda** (`RecognitionZone`),
  no fracciones 0-1 como las anotaciones. Solo se valida `x + width <= page_width + 1`.
- `ModelDetail.page_dimensions` no está tipado en el OpenAPI (se infiere
  `[{ page, width, height }]` de `exam_service.upload_blank_pdf`).
- **Mitigación**: `createZone` acepta objeto o lista; el editor trabaja en porcentajes
  desde arriba a la izquierda y convierte con `zoneGeometry.js` (test de ida y vuelta).
- **Propuesta**: `responses={201: ZoneResponseSerializer(many=True)}` y marcar
  `zone_type` como requerido en el esquema.

## gap-9 · OCR de anotaciones: formato de trazos y códigos de error
- `_render_stylus_to_image` (apps.annotations.services) solo dibuja una lista JSON de
  trazos, cada uno una lista de `{x, y}` en **0-100**, sobre un lienzo fijo de 400×200.
  El contrato no describe el formato de `payload` y la tinta que guarda el frontend
  (`{ v: 1, strokes: [{ points, color, width, tool }] }`, coordenadas 0-1, como pide la
  convención de anotaciones relativas) se renderiza como una imagen **en blanco**: el OCR
  sobre la tinta de una página nunca reconoce nada.
- Ambas vistas devuelven 400 con códigos que el OpenAPI no declara (`NOT_AUTHOR`,
  `NO_PROBLEM_ASSOCIATED`, `NO_CONTENT`, `NOT_STYLUS`, `UNSUPPORTED_TYPE`); el esquema solo
  lista `VALIDATION_ERROR`. `NOT_AUTHOR` debería ser 403.
- Crear una anotación con `is_grade_annotation` ya lanza el OCR y puede aplicar la nota
  (RF-10.5), pero la respuesta de creación no informa del resultado: hay que volver a
  llamar a `ocr-grade/`, que repite el reconocimiento.
- **Mitigación**: el frontend reconoce desde un panel propio y envía ese panel en el
  formato del renderizador como anotación aparte (`src/features/grading/ocr.js`); la
  tinta de página y la vista del estudiante ignoran esas anotaciones.
- **Propuesta**: documentar el `payload` STYLUS en el esquema y aceptar en el renderizador
  el formato `{ strokes: [{ points }] }` con coordenadas 0-1 (y el tamaño real de la
  página); declarar los códigos de error y devolver el resultado del OCR al crear.

## gap-10 · Respuestas que dependen del rol y el OpenAPI no declara
Detectado por el test de contrato del mock (`src/test/contract/`), contrastado con el código.
- `GET /exams/{id}/`, `GET /subjects/{id}/exams/` y `GET /my-exams/` declaran `ExamFull`,
  pero las vistas (`apps/exams/views/exams.py`) eligen serializer por rol: `ExamFull`
  (`can_create_exams`), `ExamTeacher` (sin `student_permissions`) o `ExamBasic` (alumnado:
  sin `models_problems` ni `convocation`). Un cliente generado del esquema daría por
  presentes campos que faltan.
- `ExamFull.models_problems` se tipa como `[{string: string}]` (`extend_schema_field` con
  `DictField(child=CharField())`, comentado como "Simplificado"), pero `problems` es una
  lista de `ProblemResponse`. Afecta también a `PATCH /exams/{id}/`, que responde con
  `ExamFullSerializer` (lo destapó la primera prueba de interfaz que guarda los datos del examen).
- `GET /exams/{id}/instances/` declara `PaginatedInstanceResponseList`, pero un alumno
  recibe una lista sin paginar de `StudentInstanceSerializer` (`InstanceListView`), y
  `GET /instances/{id}/` le devuelve también `StudentInstanceSerializer`, no `InstanceResponse`.
- **Mitigación**: el frontend ya trataba estas formas; el test acepta como alternativas las
  formas reales transcritas de los serializers (`backend-shapes.js`) y falla si alguna deja
  de usarse (señal de que el hueco se ha corregido).
- **Propuesta**: declarar `oneOf` con los tres serializers de examen y los dos de instancia
  (`PolymorphicProxySerializer` de drf-spectacular) y tipar `models_problems` con un
  serializer propio.

## gap-11 · Errores de servicio y campos nulos que el OpenAPI no declara
Detectado al extender el test de contrato a las mutaciones (`src/test/contract/mutations.js`):
cada POST/PUT/PATCH/DELETE que las pruebas de flujo envían al mock se valida contra la
instantánea del OpenAPI. Las 18 discrepancias distintas de la rama claude y las 2 de la integración
(admin de Codex) se contrastaron con el código Django:
- **Errores**: las vistas capturan los `*ServiceError` y responden `{"error_code": exc.code}`
  con estados y códigos que el esquema no declara: 409 en `POST/DELETE /exams/...`,
  `POST /models/{id}/page-profiles/`, `PATCH /instances/{id}/`; 409 `VERSION_CONFLICT` y
  `SCORE_EXCEEDS_MAX` en la calificación (`apps/grading/services/grading.py`); 400
  `INVALID_TRANSITION`, `INVALID_PDF`, `ZONE_EXCEEDS_PAGE_WIDTH` sin `errors`; 404
  `TARGET_NOT_FOUND`/`PAGE_NOT_ORPHAN` (`apps/instances/views/instances.py`). El esquema
  solo enumera el código genérico de cada estado (`CONFLICT`, `VALIDATION_ERROR` con
  `errors` obligatorio, `NOT_FOUND`).
- **Campos nulos**: `Exam.date` y `AcademicCourse.start_date/end_date` son `null=True`,
  pero sus serializers de salida los declaran no anulables (`POST /subjects/{id}/exams/`,
  `POST /courses/`, `PATCH /courses/{id}/`).
- **Lista por objeto**: `POST /page-profiles/{id}/zones/` declara un `ZoneResponse` y
  responde `ZoneResponseSerializer(zones, many=True)`.
- **Fallo real del mock** (corregido): `POST /exams/{id}/models/` devolvía
  `page_dimensions: null`; el modelo usa `default=list`, así que es `[]`.
- **Mitigación**: los errores se validan contra el sobre que construyen
  `apps/core/utils/exceptions.py` y las vistas (`error_code` en mayúsculas, `errors`
  opcional de listas de cadenas, nada más); las respuestas 2xx deben tener estado
  declarado y validar contra el esquema o contra la forma real (`MUTATION_SHAPES`).
- **Propuesta**: declarar en cada vista los códigos de servicio que puede devolver
  (`OpenApiResponse` con el enum de `apps/core/openapi/errors.py`, que ya los lista) y
  `allow_null=True` en los campos de salida anulables.

## gap-12 · Filtro `role` de los miembros de una asignatura sin declarar
- `GET /subjects/{id}/members/` filtra por `?role=` (`MemberListCreateView.get`,
  `apps/subjects/views/subjects_components.py`), pero el OpenAPI solo declara `page` y
  `page_size`. Un cliente fiel al contrato no puede saber que existe.
- **Mitigación**: `listSubjectMembers` (`src/features/exams/api.js`) recorre todas las páginas y
  filtra el rol en el cliente; no depende del parámetro.
- **Propuesta**: `OpenApiParameter("role", enum=Role.choices)` en el `extend_schema` de la vista.

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
