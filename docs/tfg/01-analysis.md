# 01 · Análisis inicial del repositorio y del backend

Fecha: 2026-10-17. Punto de partida: rama `modulo-profesor` @ `7ca9b72` (15 commits).

## 1. Orden seguido
1. **Inventario del repo frontend** (`git branch -a`, `git log`, listado de ficheros):
   React 19 + Vite 7, JS, react-router 7, react-i18next, react-pdf. Una sola rama.
2. **Documentación existente**: `CLAUDE.md`, `docs/API_CONTRACT.md` (2026-04-20),
   `docs/FRONTEND_STATE.md`, `docs/DIARIO_DESARROLLO.md`, `memory/*.md`.
   El contrato documentaba la "Fase 0" del backend (solo `/health/`) y endpoints *planificados*.
3. **Localización del backend real**: la memoria del repo apuntaba a
   `anxoCRuam/SCDEE`, rama `backend`. Último commit `a8eb9f43` (2026-05-19).
4. **Clonado**: el clon completo y el clon superficial fallaron (`early EOF` /
   `invalid index-pack`) por binarios pesados en `docs/`. Solución: clon parcial
   `--filter=blob:none` + *sparse checkout* de `backend/` y `docs/files/spectacular/`.
   El árbol se obtuvo antes vía API de GitHub (`git/trees/backend?recursive=1`, 791 entradas)
   para decidir qué descargar.
5. **Fuente de verdad del contrato**: `docs/files/spectacular/SCDEE API.yaml`
   (OpenAPI generado por drf-spectacular, 534 KB). Extracción determinista con dos
   scripts (`scripts/analyze/endpoints.py`, `schemas.py`) → `docs/frontend/API_INVENTORY.md`.
6. **Verificación contra el código** (no solo el schema) en los puntos donde el schema
   podía no reflejar el comportamiento: vistas de auth, `MySubjectsView`, `InstanceListView`,
   `InstanceDetailView`, `access_control.py`, `grading.py`, `reviews.py`, `jwt_plugin.py`,
   `VALID_TRANSITIONS`, `DEFAULT_PERMISSIONS`.

## 2. Qué se infirió automáticamente
| Información | Fuente | Método |
|---|---|---|
| 96 operaciones REST, tags, request/response | OpenAPI | script |
| 127 schemas con campos, tipos, requeridos | OpenAPI | script |
| Esquema de auth (Bearer JWT) | `securitySchemes` | script |
| Nombres de campos de tokens (`access_token`, `refresh_token`) | OpenAPI + `views/auth.py` | script + lectura |
| Claims del JWT (`is_staff`, `is_superadmin`, `organization_id`) | `jwt_plugin.py` | lectura de código |
| Rol **por asignatura** (COORDINATOR/TEACHER/STUDENT) | `MySubject.role`, `MembershipRole` | lectura |
| Tabla de permisos por rol | `DEFAULT_PERMISSIONS` | lectura (copiada a `src/lib/permissions.js`) |
| Máquina de estados de instancias | `VALID_TRANSITIONS` | lectura |
| Visibilidad del alumno (permisos + ventana de revisión) | `access_control._student_access` | lectura |
| Concurrencia optimista en notas (`old_score`, `VERSION_CONFLICT`) | `grading.py` | lectura |
| Serializers distintos según rol (ExamBasic/Teacher/Full; StudentInstance) | `serializers/*.py` | lectura |
| Formato de errores simbólicos | `ErrorResponse*`, `exceptions.py` | script + lectura |
| Paginación offset (`count, page, page_size, total_pages, results`) | `pagination.py`, schemas `Paginated*` | script |
| Almacenamiento de anotaciones (payload en MinIO + `download_url` presignada) | `annotations/services`, serializer | lectura |

## 3. Desajustes del frontend previo detectados (por comparación con el backend real)
1. Login leía `data.access`/`data.refresh`; el backend devuelve `access_token`/`refresh_token`.
   Refresh y logout enviaban `{refresh}` en lugar de `{refresh_token}`.
2. Rol global derivado de `is_staff` (PROFESSOR/STUDENT). En el backend `is_staff`
   significa *gestor de organización* y el rol docente es por asignatura.
3. El login no devuelve `is_staff`: solo está en el JWT.
4. Precarga de anotaciones leía `annotation.payload`, que no existe en la respuesta
   (`AnnotationResponse` expone `download_url`).
5. Estados de instancia "simplificados" (PENDING/CORRECTED/...) inexistentes en el backend.
6. Estado y anotaciones persistidos en `localStorage` como fuente de verdad.

Conclusión: más barato reescribir la capa de datos y la UI que adaptar la existente.
Se conservó en el tag `legacy/modulo-profesor-v1`. Se reutilizó la lógica del canvas
(coordenadas relativas 0-1) del componente `PdfCanvas` original.

## 4. Qué habría requerido preguntar al usuario
- **Dirección visual**: se dio una URL de referencia. Se interpretó demasiado literal
  (paleta y tipografía) y el usuario corrigió: solo quería el minimalismo. → La
  pregunta correcta era "¿qué eje de la referencia te gusta: estructura, color, tipografía?".
- **Nota de aprobado** (5/10): no existe en el backend; se asumió convención española.
- **Qué hacer con los huecos del backend** (ver 03): no se pueden resolver desde el frontend.
- Prioridad entre áreas funcionales: inferida del propio flujo (corregir → publicar → revisar).

## 5. Del conocimiento del backend a requisitos de frontend
1. Agrupar endpoints por *tag* y por *actor* (gestor / coordinación / docente / alumno).
2. Para cada actor, ordenar operaciones por el ciclo de vida del recurso principal
   (instancia de examen: ASSEMBLING → … → FINALIZED).
3. Cada transición o acción = un botón con su permiso (`can_*`) y su error esperado.
4. Cada lista paginada = tabla con estados vacío / carga / error / sin permiso.
5. Cada condición de visibilidad del backend = una variante de vista (p. ej. el alumno
   ve el PDF solo en revisión abierta).
6. Cada hueco (dato necesario que ningún endpoint da) = pregunta al equipo backend.
