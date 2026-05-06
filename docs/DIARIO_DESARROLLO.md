# Diario de Desarrollo — SCDE Frontend

Este documento registra de forma cronológica las sesiones de trabajo, qué se implementó,
las decisiones técnicas tomadas y su justificación. Sirve de base para la memoria formal del TFG.

---

## Sesión 1 — Prototipo inicial de login y vistas mock
**Fecha aproximada:** 2026-04-10 al 2026-04-20  
**Rama:** `modulo-profesor`

### Qué se implementó
- Configuración del proyecto Vite + React con react-i18next (i18n) y react-router-dom.
- `AuthContext` con estado global de autenticación (JWT simulado).
- `ProtectedRoute` con guardia por rol (`PROFESSOR` / `STUDENT`).
- `AppRouter` con rutas públicas y protegidas.
- `AppLayout` con cabecera, navegación y salida de contenido.
- `LoginPage` con formulario de credenciales (mock: `maria.perez@uni.es` / `prof123`).
- `ProfessorDashboardPage`: dashboard de bienvenida para el profesor.
- `ProfessorSubjectsPage`: grid de asignaturas con tarjetas coloreadas.
- `ProfessorExamsPage`: tabla de exámenes para una asignatura.
- `ProfessorInstancesPage`: tabla de instancias de un examen con estados.
- `ProfessorCorrectionPage`: visor PDF con lienzo de anotaciones (Canvas API).
  - Anotaciones con `pdf.js` para renderizado de páginas.
  - Trazos (strokes) guardados en `localStorage` con coordenadas relativas 0-1.
  - Barra de herramientas (`AnnotationToolbar`) para pincel, color y grosor.
  - Campo de comentario de texto por instancia.
  - Botón "Finalizar" que persiste en `localStorage`.
- `StudentSubjectsPage`: grid de asignaturas para el rol estudiante (solo mock).
- `apiClient.js`: cliente HTTP basado en Axios con interceptores JWT y auto-refresh.
- `authService.js`: login/logout con soporte mock y real; mapea `is_staff=True` → `PROFESSOR`.
- `userService.js`: CRUD de usuarios con paginación.
- Ficheros de i18n (`es.json`, `en.json`) con textos para ambos roles.
- CSS con diseño responsive para todas las páginas.

### Decisiones técnicas
- **VITE_MOCK_API=true** en `.env.development`: permite desarrollar el frontend sin backend, activando
  datos estáticos en cada servicio mediante un flag de entorno.
- **Coordenadas relativas (0-1)** para anotaciones: desacopla el renderizado del tamaño del PDF,
  garantizando que las posiciones sean correctas en cualquier resolución de pantalla o escala de zoom.
- **localStorage** como almacenamiento temporal de anotaciones: permite persistencia entre recargas
  sin necesidad de backend real en esta fase.
- **Roles mapeados desde `is_staff`**: el backend Django usa `is_staff=True` para profesores; el
  frontend lo traduce a `PROFESSOR` en `authService.js` para mantener semántica clara.
- **react-i18next** desde el inicio: requisito del TFG (RF-14.x), facilita la internacionalización
  sin refactorizaciones posteriores.

### Estado al finalizar
- Todo el flujo del profesor funciona con datos mock.
- Las anotaciones se guardan y cargan desde localStorage.
- Sin conexión al backend real (pendiente de implementar servicios).

---

## Sesión 2 — Capa de servicios reales (módulo profesor)
**Fecha aproximada:** 2026-04-21 al 2026-05-04  
**Rama:** `modulo-profesor`

### Contexto
El compañero (Anxo) publicó el backend con prácticamente todos los endpoints implementados en un solo
commit grande (`040a444 feat(untested version): Version with last changes`). A partir de ese momento
fue posible diseñar la integración real.

### Qué se implementó

#### Nuevos servicios (`src/services/`)
- **`subjectService.js`**: `getMySubjects()` → `GET /api/v1/my-subjects/`.
  - Devuelve las asignaturas del usuario autenticado (filtrado automático por organización en el backend).
  - Nota: requiere un `AcademicCourse` activo en la BD del backend; si no existe devuelve `[]`.

- **`examService.js`**: `getExamsBySubject(subjectId)` → `GET /api/v1/subjects/{id}/exams/`.
  - Maneja tanto respuesta como array plano `[...]` como paginada `{ results: [...] }`.

- **`instanceService.js`**: conjunto completo de funciones para instancias.
  - `getInstancesByExam(examId)` → `GET /api/v1/exams/{id}/instances/`
  - `getInstance(instanceId)` → `GET /api/v1/instances/{id}/`
  - `downloadInstancePdf(instanceId)` → `GET /api/v1/instances/{id}/download/` (fetch nativo, devuelve Blob URL)
  - `transitionInstance(instanceId, backendStatus)` → `PATCH /api/v1/instances/{id}/transition/`
  - `normalizeInstance(inst)`: mapea campos backend a estructura frontend (extrae nombre/apellido del email).
  - `mapInstanceStatus(backendStatus)`: reduce 9 estados backend a 4 estados frontend:
    - `ASSEMBLING|RECEIVED|QUEUED|PENDING_GRADING` → `PENDING`
    - `GRADED|PUBLISHED` → `CORRECTED`
    - `IN_REVIEW|PENDING_REVIEW` → `REVIEW_REQUESTED`
    - `FINALIZED` → `CLOSED`
    - `ARCHIVED` → `PENDING` (por defecto; instancias archivadas no aparecen en el flujo normal)

- **`annotationService.js`**: sincronización de anotaciones con el backend.
  - `getAnnotations(instanceId)` → `GET /api/v1/instances/{id}/annotations/`
  - `createAnnotation(instanceId, data)` → `POST /api/v1/instances/{id}/annotations/`
  - `updateAnnotation(annotationId, payload)` → `PUT /api/v1/annotations/{id}/`
  - `syncAnnotations(instanceId, data)`: estrategia de sync — busca anotaciones existentes por tipo
    (`STYLUS`/`TEXT`), hace `PUT` si ya existen o `POST` si son nuevas.
  - `preloadAnnotationsToLocalStorage(instanceId, authorEmail)`: carga anotaciones del backend a
    `localStorage` al entrar en la vista de corrección para que `useAnnotations` las recupere de forma
    transparente sin cambiar el hook.

- **`index.js`** (barrel export): exporta todos los servicios desde un único punto de entrada,
  simplificando los imports en los componentes.

#### Páginas actualizadas
- **`ProfessorSubjectsPage`**: usa `getMySubjects()` en modo real; en mock sigue usando `user.subjects`.
- **`ProfessorExamsPage`**: usa `getExamsBySubject(subjectId)` con el UUID pasado por router state.
- **`ProfessorInstancesPage`**: usa `getInstancesByExam(examId)` con normalización de instancias.
- **`ProfessorCorrectionPage`**: en modo real hace `Promise.all` de:
  1. `getInstance()` → metadatos de la instancia.
  2. `downloadInstancePdf()` → PDF como Blob URL para pdf.js.
  3. `preloadAnnotationsToLocalStorage()` → carga anotaciones existentes.
  El botón "Finalizar" llama `syncAnnotations()` y luego `transitionInstance()`.

### Decisiones técnicas
- **Un servicio por recurso backend**: separación de responsabilidades, facilita el testing unitario
  y la mantenibilidad.
- **`normalizeInstance` centralizada**: la lógica de mapeo de campos y extracción de nombre/apellido
  del email vive en un único lugar para evitar duplicación en los componentes.
- **Estrategia de sync de anotaciones (PUT-or-POST)**: el backend almacena una anotación `STYLUS`
  y una `TEXT` por instancia. En lugar de borrar y recrear, se hace `PUT` si ya existen,
  lo que reduce llamadas y es idempotente.
- **Blob URL para PDF**: se usa `fetch` nativo en `downloadInstancePdf` en lugar de Axios porque
  Axios no maneja bien la respuesta binaria para crear Blob URLs. El token JWT se inyecta manualmente
  en el header `Authorization`.
- **`preloadAnnotationsToLocalStorage`**: se decidió mantener `useAnnotations` leyendo de `localStorage`
  en lugar de refactorizar el hook para que lea de la API directamente. Esto minimiza el riesgo de
  introducir regresiones en el visor de anotaciones.

### Verificación de compatibilidad (realizada en sesión 3)
- `InstanceResponseSerializer` devuelve `student_email`, `status`, `total_score`, `has_issues` → ✅
- `TransitionSerializer` acepta `target_status` con los valores de `InstanceStatus.choices` → ✅
- `UpdateAnnotationSerializer` acepta solo `{ payload }` → ✅ (coincide con `updateAnnotation`)
- `InstanceDownloadView` existe en `instances/<uuid>/download/` → ✅
- `MySubjectSerializer` devuelve `id`, `name`, `code`, `semester` → ✅

### Estado al finalizar
- Todos los servicios del módulo profesor implementados con soporte mock/real.
- `VITE_MOCK_API=true` en `.env.development` (aún en modo mock).
- Pendiente: activar `VITE_MOCK_API=false` y realizar pruebas de integración contra el backend real.
- Pendiente: módulo del estudiante (vistas de resultados).

---

## Sesión 3 — Documentación y verificación de alineación frontend/backend
**Fecha:** 2026-05-05  
**Rama:** `modulo-profesor`

### Qué se hizo
- Se creó este fichero `DIARIO_DESARROLLO.md` como base para la memoria formal del TFG.
- Se verificó la alineación entre los servicios del frontend y los endpoints del backend:
  - Revisión de `apps/instances/views.py`, `apps/instances/serializers.py`, `apps/instances/urls.py`.
  - Revisión de `apps/annotations/views.py`, `apps/annotations/serializers.py`.
  - Revisión de `apps/subjects/serializers/serializers.py` (MySubjectSerializer).
- Se actualizó `FRONTEND_STATE.md` para reflejar el estado real (servicios añadidos).
- Se añadió memoria de Claude sobre la obligatoriedad de documentar cada sesión.

### Decisiones / hallazgos
- El estado `ARCHIVED` de instancias no se manejaba en `mapInstanceStatus`; cae al `default: PENDING`,
  que es aceptable porque las instancias archivadas no aparecen en el flujo de corrección activo.
- La firma de `PUT /annotations/{id}/` acepta solo `{ payload }`, lo que coincide exactamente con
  la implementación de `updateAnnotation` en el frontend.

### Próximos pasos
1. **Módulo estudiante**: `StudentSubjectsPage` usa `user.subjects` del mock en lugar de `getMySubjects()`.
   Hay que actualizar la página y añadir navegación a resultados de exámenes.
2. **Vistas de resultado para estudiante**: el estudiante debe poder ver el PDF de su examen corregido
   con las anotaciones del profesor (RF-12.x). Falta crear `StudentExamsPage` y `StudentResultPage`.
3. **Pruebas de integración**: arrancar el backend con Docker Compose y probar el flujo completo
   con `VITE_MOCK_API=false`.
4. **Gestión de errores**: las páginas del profesor muestran errores mínimos; habría que mejorar
   los mensajes de error cuando el backend devuelve 4xx/5xx.

---

---

## Sesión 4 — Módulo del estudiante: vistas de resultados
**Fecha:** 2026-05-05  
**Rama:** `modulo-profesor`

### Qué se implementó

#### Componentes modificados
- **`PdfCanvas.jsx`**: añadida prop `readOnly` (booleano, default `false`).
  - En modo `readOnly`, los manejadores de puntero (`onPointerDown`, `onPointerMove`, `onPointerUp`) no
    ejecutan lógica de dibujo. El canvas sigue renderizando los trazos ya guardados.
  - El cursor cambia a `default` en modo solo lectura.

- **`PdfViewer.jsx`**: añadida prop `readOnly` (booleano, default `false`).
  - Cuando `readOnly=true`, no renderiza `AnnotationToolbar` ni la caja de comentario de texto.
  - Pasa `readOnly` a `PdfCanvas` para deshabilitar el dibujo.
  - El visor sigue cargando las anotaciones desde `localStorage` (a través de `useAnnotations`),
    lo que permite al estudiante ver los trazos del profesor.

#### Páginas nuevas
- **`StudentSubjectsPage.jsx`** (refactorizado completo):
  - Ahora usa `getMySubjects()` del servicio real, igual que `ProfessorSubjectsPage`.
  - Navega a `/student/subjects/:subjectId` pasando `subjectCode` y `subjectName` por router state.
  - En modo mock usa `user.subjects` del contexto.

- **`StudentExamsPage.jsx`** (nueva):
  - Ruta: `/student/subjects/:subjectId`
  - Llama `getExamsBySubject(subjectId)` para listar los exámenes de la asignatura.
  - Cada examen navega a `/student/result/:examId`.
  - Reutiliza los estilos de `ProfessorExamsPage.css` (mismas clases CSS).

- **`StudentResultPage.jsx`** (nueva):
  - Ruta: `/student/result/:examId`
  - Busca la instancia del estudiante llamando `getInstancesByExam(examId)` y filtrando
    por `instance.email === user.email` (filtro client-side, ya que el endpoint no filtra por alumno).
  - Descarga el PDF con `downloadInstancePdf(instanceId)`.
  - Carga las anotaciones del backend a `localStorage` con `preloadAnnotationsToLocalStorage()`.
  - Lee el `textComment` de `localStorage` para mostrarlo como "Comentarios del profesor".
  - Muestra `PdfViewer` en modo `readOnly` con los trazos del profesor superpuestos.
  - Muestra la nota con `GradePill` (verde si ≥5, rojo si <5).

#### Router
- **`AppRouter.jsx`** actualizado con las nuevas rutas del estudiante:
  - `/student/subjects/:subjectId` → `StudentExamsPage`
  - `/student/result/:examId` → `StudentResultPage`

#### i18n
- Añadidos a `es.json` y `en.json`:
  - `student.exams.title`, `student.exams.empty`
  - `student.result.title`, `student.result.grade`, `student.result.noInstance`,
    `student.result.noPdf`, `student.result.comments`

### Decisiones técnicas
- **Filtro client-side de instancias**: el endpoint `GET /exams/{id}/instances/` devuelve todas las
  instancias de un examen. Para el estudiante se filtra por `instance.email === user.email` en el
  cliente. Esto es aceptable en esta fase dado que el backend está "sin probar"; si se añade un filtro
  de servidor en el futuro, el cambio solo afecta al servicio.
- **`readOnly` en lugar de crear nuevo componente**: añadir la prop al visor existente evita duplicar
  código de renderizado de PDF y de lectura de anotaciones. El coste es mínimo (tres condicionales).
- **Blob URL revocado en cleanup**: `StudentResultPage` revoca el Blob URL en el `return` del
  `useEffect` para evitar memory leaks (el mismo patrón que `ProfessorCorrectionPage`).

### Estado al finalizar
- Flujo completo del estudiante implementado (mock + real).
- Build de producción limpio (145 módulos, sin errores TypeScript/lint).
- `VITE_MOCK_API=true` sigue activo; pendiente de pruebas de integración contra el backend real.

### Próximos pasos
1. Pruebas de integración con el backend real (`VITE_MOCK_API=false` + Docker Compose del backend).
2. Verificar que el endpoint `GET /exams/{id}/instances/` filtra correctamente para estudiantes
   o añadir filtro `student_email` en el backend.
3. Gestión de errores mejorada (mensajes más informativos en 4xx/5xx).
4. Posible mejora: mostrar el estado del examen (PENDING/CORRECTED) en `StudentExamsPage` para
   que el estudiante sepa si ya tiene resultado disponible antes de hacer clic.

---

*Última actualización: 2026-05-05*
