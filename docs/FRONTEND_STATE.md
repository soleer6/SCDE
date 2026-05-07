# FRONTEND_STATE.md — Mapa del Prototipo SCDE

> Última actualización: 2026-05-07  
> Rama: `modulo-profesor`

---

## Árbol de componentes

```
src/
├── main.jsx                          # Punto de entrada, montaje de React con i18n
├── App.jsx                           # Wrapper con Router + AuthProvider
├── index.css                         # Estilos globales
├── router/
│   ├── AppRouter.jsx                 # Definición de rutas públicas/protegidas
│   └── ProtectedRoute.jsx            # Guardia de autenticación por rol
├── context/
│   └── AuthContext.jsx               # Estado global de autenticación
├── layouts/
│   └── AppLayout.jsx                 # Layout principal (header/footer/nav)
├── pages/
│   ├── LoginPage.jsx                 # Formulario de login
│   ├── ProfessorDashboardPage.jsx    # Panel resumen del profesor (stats + acceso rápido)
│   ├── ProfessorSubjectsPage.jsx     # Lista de asignaturas (PROFESSOR)
│   ├── ProfessorExamsPage.jsx        # Lista de exámenes por asignatura
│   ├── ProfessorInstancesPage.jsx    # Tabla de instancias de un examen
│   ├── ProfessorCorrectionPage.jsx   # Vista de corrección con PDF
│   ├── StudentSubjectsPage.jsx       # Lista de asignaturas (STUDENT)
│   ├── StudentExamsPage.jsx          # Lista de exámenes del alumno por asignatura
│   └── StudentResultPage.jsx         # PDF corregido + nota + solicitud de revisión
├── components/
│   └── PdfViewer/
│       ├── PdfViewer.jsx             # Contenedor principal PDF + toolbar
│       ├── PdfCanvas.jsx             # Canvas transparente para anotaciones
│       ├── AnnotationToolbar.jsx     # Barra de herramientas
│       └── PdfViewer.css
├── hooks/
│   └── useAnnotations.js             # Hook para gestionar anotaciones por página
├── api/
│   ├── authService.js                # Login mock (heredado, no usar en código nuevo)
│   └── mockData.js                   # Mock exámenes, instancias, metadata (ids string)
├── services/                          # ✅ CAPA DE SERVICIOS COMPLETA
│   ├── apiClient.js                  # Cliente Axios base con interceptores JWT
│   ├── authService.js                # Wrapper auth (mock/real según VITE_MOCK_API)
│   ├── userService.js                # CRUD usuarios
│   ├── subjectService.js             # GET /my-subjects/ (asignaturas del usuario)
│   ├── examService.js                # GET /subjects/{id}/exams/
│   ├── instanceService.js            # CRUD instancias + normalización + transición de estado
│   ├── annotationService.js          # GET/POST/PUT anotaciones + sync localStorage↔backend
│   └── index.js                      # Exportador central (barrel)
└── i18n/
    ├── index.js                      # Configuración i18next
    └── locales/
        ├── es.json                   # Traducciones español
        └── en.json                   # Traducciones inglés
```

---

## Rutas definidas

| Ruta | Componente | Rol | Estado | Descripción |
|------|-----------|-----|--------|-------------|
| `/login` | LoginPage | público | ✅ Funcional | Autenticación email/password |
| `/professor` | ProfessorDashboardPage | PROFESSOR | ✅ Funcional (mock+real) | Panel resumen con stats async |
| `/professor/subjects` | ProfessorSubjectsPage | PROFESSOR | ✅ Funcional (mock+real) | Lista de asignaturas del profesor |
| `/professor/subjects/:code` | ProfessorExamsPage | PROFESSOR | ✅ Funcional (mock+real) | Exámenes de una asignatura |
| `/professor/exams/:examId` | ProfessorInstancesPage | PROFESSOR | ✅ Funcional (mock+real) | Instancias de un examen (tabla alumnos) |
| `/professor/correction/:instanceId` | ProfessorCorrectionPage | PROFESSOR | ✅ Funcional (mock+real) | Corrección con PDF + anotaciones + sync backend |
| `/student/subjects` | StudentSubjectsPage | STUDENT | ✅ Funcional (mock+real) | Lista de asignaturas del alumno |
| `/student/subjects/:subjectId` | StudentExamsPage | STUDENT | ✅ Funcional (mock+real) | Exámenes del alumno en una asignatura |
| `/student/result/:examId` | StudentResultPage | STUDENT | ✅ Funcional (mock+real) | PDF corregido + nota + solicitud de revisión |
| `*` | Navigate → /login | — | ✅ | Redirección por defecto |

---

## Estado de vistas y componentes

### LoginPage ✅ FUNCIONAL
- Estado interno: `email`, `password`, `error`, `loading`, `showPassword`
- Toggle mostrar/ocultar contraseña
- Manejo de errores con i18n
- Redirección post-login según rol (PROFESSOR → `/professor`, STUDENT → `/student/subjects`)
- **Data**: Mock (`VITE_MOCK_API=true`) o API real
- **localStorage escribe**: `scde_token`, `scde_token_refresh`, `scde_user`

### ProfessorDashboardPage ✅ FUNCIONAL (mock + real)
- Carga async: `getMySubjects` → por cada asignatura `getExamsBySubject` + `getInstancesByExam`
- En mock mode: aplica `getStoredCorrection` sobre instancias para reflejar correcciones guardadas
- Stats: nº asignaturas, nº exámenes, pendientes, corregidas
- Acceso rápido a asignaturas con indicador de pendientes
- Barras de progreso de corrección por asignatura

### ProfessorSubjectsPage ✅ FUNCIONAL (mock + real)
- Llama `getMySubjects()` en modo real; consume `user.subjects` del mock.
- Grid de asignaturas con colores rotatorios y contador de stats.
- Navega a `ProfessorExamsPage` pasando code en URL y UUID de la asignatura por router state.
- **Data**: `subjectService.getMySubjects()` o `user.subjects` (mock).

### ProfessorExamsPage ✅ FUNCIONAL (mock + real)
- Recibe `subjectId` desde router state (UUID real o 'mock-sub-1' en mock).
- Fallback: si no llega por state, busca el id en `user.subjects` por código de URL.
- Lista de exámenes con badges de estado.
- **Data**: `examService.getExamsBySubject(subjectId)`.

### ProfessorInstancesPage ✅ FUNCIONAL (mock + real)
- Parámetros de ruta: `:examId` (UUID en modo real, 'mock-exam-1' en mock).
- Busca exam metadata en api/mockData (mock) con ids string coherentes.
- Tabla de instancias; en mock merge con localStorage para mostrar correcciones guardadas.
- **Data**: `instanceService.getInstancesByExam(examId)` + `getStoredCorrection`.

### ProfessorCorrectionPage ✅ FUNCIONAL (mock + real)
- Parámetros de ruta: `:instanceId`.
- Mock: carga instancia de api/mockData (ids string 'mock-inst-1'), PDF desde `/mock-pdfs/`.
- Real: Promise.all de `getInstance` + `downloadInstancePdf` + `preloadAnnotationsToLocalStorage`.
- Botón "Finalizar": llama `syncAnnotations()` (localStorage → backend) + `transitionInstance()`.
- Input de calificación 0-10 con validación y toggle de estado.
- **Data**: `instanceService`, `annotationService`, PDF vía Blob URL o mock path.

### PdfViewer + PdfCanvas ✅ FUNCIONAL
- Props de `PdfViewer`: `pdfUrl`, `author`, `instanceId`, `readOnly` (para modo estudiante).
- Carga PDF con `pdf.js`; canvas superpuesto para anotaciones.
- Toolbar: pen, eraser (destination-out), colores, grosores, undo, clear page, add comment, save.
- Navegación multipágina.
- Coordenadas relativas 0-1 (nunca píxeles absolutos).
- **Data**: `localStorage` (`scde_annotations_{instanceId}`), preloaded desde backend al entrar.

### StudentSubjectsPage ✅ FUNCIONAL (mock + real)
- Mock: usa `user.subjects` (que ahora incluyen `id: 'mock-sub-1'`).
- Real: llama `getMySubjects()`.
- Links a `/student/subjects/${subject.id}` con state `{ subjectCode, subjectName }`.

### StudentExamsPage ✅ FUNCIONAL (mock + real)
- Recibe `subjectId` del URL param (UUID real o 'mock-sub-1' en mock).
- Lista de exámenes; ExamCard navega a `/student/result/${exam.id}`.
- **Data**: `examService.getExamsBySubject(subjectId)`.

### StudentResultPage ✅ FUNCIONAL (mock + real)
- Recibe `:examId` del URL.
- Llama `getInstancesByExam(examId)` y filtra por `inst.email === user.email` para encontrar la propia instancia del alumno.
- Muestra nota, estado, comentarios del profesor (de localStorage/API).
- En modo real: descarga PDF vía `downloadInstancePdf` + precarga anotaciones.
- Botón "Solicitar revisión" visible si `status === CORRECTED` o `CLOSED`; llama `transitionInstance(PENDING_REVIEW)` en real API.
- **Data**: `instanceService`, `annotationService`.

---

## Contextos y hooks

### AuthContext

```javascript
{
  user: {
    firstName, lastName, nia, email,
    role,       // 'PROFESSOR' | 'STUDENT'
    subjects    // array de asignaturas con id, code, name, semester
  } | null,
  token: string | null,
  login: async (email, password) => user,
  logout: () => void,
  loading: boolean   // durante restauración de sesión
}
```

- **localStorage**: `scde_token`, `scde_token_refresh`, `scde_user`
- Restaura sesión automáticamente al montar `AuthProvider`

### useAnnotations(instanceId, author)

```javascript
{
  strokesByPage: { [page]: Stroke[] },
  addStroke: (page, points, color, width, tool) => void,
  clearPage:  (page) => void,
  undo:       (page) => void,
  getStrokes: (page) => Stroke[],
  textComment: string,
  setTextComment: (text) => void,
  loadAnnotations: () => void,
  saveAnnotations: () => void
}
```

Estructura de un `Stroke`:
```javascript
{
  page:      number,
  points:    [{ x: 0-1, y: 0-1 }, ...],  // coordenadas relativas
  color:     string,
  width:     number,
  tool:      'pen' | 'eraser',
  timestamp: number,
  author:    string
}
```

**Formato de persistencia** (`scde_annotations_{instanceId}`):
```javascript
{
  instanceId:   string,            // id de la instancia (puede ser string o número)
  author:       string,            // email del profesor
  savedAt:      timestamp,
  textComment:  string,
  strokes:      Stroke[]
}
```

---

## Mock data — IDs canónicos

Todos los ids de mock son string para coherencia con la futura API UUID:

| Entidad | Id | Descripción |
|--------|-----|-------------|
| Asignatura MAT101 | `mock-sub-1` | Matemáticas I |
| Asignatura FIS101 | `mock-sub-2` | Física I |
| Examen Parcial 1 MAT | `mock-exam-1` | Con instancias de elena y pablo |
| Examen Parcial 2 MAT | `mock-exam-2` | Con instancia pendiente de elena |
| Examen Parcial 1 FIS | `mock-exam-3` | Sin instancias |
| Instancia Elena Parcial1 | `mock-inst-1` | CORRECTED, nota 7.5, PDF exam_101.pdf |
| Instancia Pablo Parcial1 | `mock-inst-2` | CORRECTED, nota 6.0, PDF exam_102.pdf |
| Instancia Elena Parcial2 | `mock-inst-3` | PENDING, sin nota, PDF exam_103.pdf |

---

## Servicios y utilidades

### `/services/apiClient.js` ✅

Cliente base HTTP con interceptores JWT e auto-refresh de tokens.

| Función | Tipo | Descripción |
|---------|------|-------------|
| `apiRequest(endpoint, options)` | async | Core fetch wrapper con auth |
| `apiGet(endpoint, options)` | async | Helper GET |
| `apiPost(endpoint, body, options)` | async | Helper POST |
| `apiPatch(endpoint, body, options)` | async | Helper PATCH |
| `apiDelete(endpoint, options)` | async | Helper DELETE |
| `getAuthHeaders()` | sync | Devuelve `{ Authorization: "Bearer ..." }` |

### `/services/authService.js` ✅

| Función | Tipo | Descripción |
|---------|------|-------------|
| `login(email, password)` | async | Devuelve `{ token, token_refresh, user }` |
| `logout(refreshToken)` | async | Revoca refresh token |
| `refreshToken(token)` | async | Genera nuevo access/refresh |
| `getAuthHeaders()` | sync | Devuelve header Authorization |

**Usuarios mock disponibles**:

| Email | Password | Rol | Nombre |
|-------|----------|-----|--------|
| maria.perez@uni.es | prof123 | PROFESSOR | María Pérez García |
| juan.torres@uni.es | prof123 | PROFESSOR | Juan Torres Martínez |
| elena.r@estudiante.uni.es | est123 | STUDENT | Elena Rodríguez López |
| pablo.f@estudiante.uni.es | est123 | STUDENT | Pablo Fernández Sanz |

### `/services/instanceService.js` ✅

| Función | Entrada | Salida |
|---------|---------|--------|
| `getInstancesByExam(examId)` | string (uuid/mock-exam-*) | `Instance[]` normalizada |
| `getInstance(instanceId)` | string | `Instance` normalizada |
| `downloadInstancePdf(instanceId)` | string | Blob URL (null en mock) |
| `transitionInstance(instanceId, backendStatus)` | string, string | void |
| `normalizeInstance(inst)` | backend object | `{ id, firstName, lastName, nia, email, status, grade }` |
| `mapInstanceStatus(backendStatus)` | string | 'PENDING'\|'CORRECTED'\|'REVIEW_REQUESTED'\|'CLOSED' |
| `toBackendStatus(frontendStatus)` | string | 'GRADED'\|'PENDING_GRADING' |

---

## Internacionalización (i18n)

- **Idiomas**: Español (`es`) y Inglés (`en`)
- **Librería**: react-i18next + i18next-browser-languagedetector
- **Selector**: dropdown en `AppLayout`
- **Namespaces**: `header`, `login`, `professor`, `student`, `common`, `status`, `correction`

---

## localStorage mapeado

| Key | Tipo | Usado por | Contenido |
|-----|------|----------|----------|
| `scde_token` | string | AuthContext, authService | JWT access token |
| `scde_token_refresh` | string | AuthContext | JWT refresh token |
| `scde_user` | JSON | AuthContext | Objeto usuario completo |
| `scde_annotations_{instanceId}` | JSON | useAnnotations | Anotaciones + comentario de texto |
| `scde_correction_{instanceId}` | JSON | mockData | Nota y estado guardados en mock mode |

---

## Datos mock vs. API real

| Dato | Origen | Estado |
|------|--------|--------|
| Autenticación | `/services/authService` (mock/real por `VITE_MOCK_API`) | ✅ Funcional |
| Clientes HTTP | `/services/apiClient` con JWT + auto-refresh | ✅ Funcional |
| Gestión usuarios | `/services/userService` (listo para Fase 1) | ✅ Funcional |
| Asignaturas | `subjectService.getMySubjects()` / `user.subjects` (mock) | ✅ Mock + Real |
| Exámenes | `examService.getExamsBySubject()` | ✅ Mock + Real |
| Instancias | `instanceService.getInstancesByExam()` | ✅ Mock + Real |
| Anotaciones | localStorage (sync con backend en real mode) | ✅ Mock (local) + Real (sync) |
| PDFs | `/mock-pdfs/*.pdf` (public/) en mock; Blob URL en real | ✅ Mock + Real |

---

## Flujos de navegación por rol

### PROFESSOR
```
/login
  ↓ login correcto
/professor                           (dashboard: stats async, acceso rápido)
  ↓ click "Ver todas" o asignatura
/professor/subjects                  (grid asignaturas)
  ↓ click asignatura
/professor/subjects/:code            (lista exámenes)
  ↓ click examen
/professor/exams/:examId             (tabla instancias/alumnos)
  ↓ click fila alumno
/professor/correction/:instanceId   (PDF + canvas de anotaciones)
  ↓ poner nota, anotar, click Finalizar → sync localStorage→backend
```

### STUDENT
```
/login
  ↓ login correcto
/student/subjects                    (grid asignaturas)
  ↓ click asignatura
/student/subjects/:subjectId         (lista exámenes del alumno)
  ↓ click examen
/student/result/:examId              (PDF corregido en modo lectura + nota + comentarios)
  ↓ si status=CORRECTED/CLOSED → botón Solicitar revisión
```

---

## Configuración y entorno

| Variable | Desarrollo | Producción |
|----------|-----------|------------|
| `VITE_MOCK_API` | `true` | `false` |
| `VITE_API_URL` | `http://localhost:8000` | `http://localhost:8000` |

**Versiones clave**:
- React 19.2.0
- react-pdf 10.4.1
- react-router-dom 7.13.1
- i18next 25.8.14
- Vite 7.3.1

---

## Estado de implementación

### Módulo profesor ✅ COMPLETO
- [x] `apiClient.js` con JWT e interceptores + auto-refresh
- [x] `authService.js` wrapper (mock + real API)
- [x] `userService.js` CRUD usuarios
- [x] `subjectService.js` — `getMySubjects()`
- [x] `examService.js` — `getExamsBySubject(subjectId)`
- [x] `instanceService.js` — list, detail, download PDF, transition, normalizeInstance
- [x] `annotationService.js` — list, create, update, syncAnnotations, preload a localStorage
- [x] `ProfessorDashboardPage` con carga async de stats reales
- [x] Todas las páginas del profesor usan servicios reales (flag VITE_MOCK_API)
- [x] Mock data unificado con ids string en api/mockData y services/

### Módulo estudiante ✅ COMPLETO
- [x] `StudentSubjectsPage`: integra `getMySubjects()` en real mode
- [x] `StudentExamsPage`: lista exámenes por asignatura (mock + real)
- [x] `StudentResultPage`: PDF corregido en read-only + nota + comentarios del profesor
- [x] Solicitud de revisión desde StudentResultPage (llama transitionInstance)
- [x] Rutas `/student/subjects/:subjectId` y `/student/result/:examId`

### Pendientes técnicos
- [ ] Pruebas de integración: arrancar backend con Docker Compose y probar con `VITE_MOCK_API=false`
- [ ] Gestión de errores mejorada en páginas (actualmente muestra texto de error mínimo)
- [ ] Code splitting para reducir el chunk principal (PDF.js es grande)
