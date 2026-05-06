# FRONTEND_STATE.md — Mapa del Prototipo SCDE

> Última actualización: 2026-05-05  
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
│   ├── ProfessorSubjectsPage.jsx     # Lista de asignaturas (PROFESSOR)
│   ├── ProfessorExamsPage.jsx        # Lista de exámenes por asignatura
│   ├── ProfessorInstancesPage.jsx    # Tabla de instancias de un examen
│   ├── ProfessorCorrectionPage.jsx   # Vista de corrección con PDF
│   └── StudentSubjectsPage.jsx       # Lista de asignaturas (STUDENT)
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
│   └── mockData.js                   # Mock exámenes, instancias, metadata
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
| `/professor/subjects` | ProfessorSubjectsPage | PROFESSOR | ✅ Funcional (mock+real) | Lista de asignaturas del profesor |
| `/professor/subjects/:code` | ProfessorExamsPage | PROFESSOR | ✅ Funcional (mock+real) | Exámenes de una asignatura |
| `/professor/exams/:examId` | ProfessorInstancesPage | PROFESSOR | ✅ Funcional (mock+real) | Instancias de un examen (tabla alumnos) |
| `/professor/correction/:instanceId` | ProfessorCorrectionPage | PROFESSOR | ✅ Funcional (mock+real) | Corrección con PDF + anotaciones + sync backend |
| `/student/subjects` | StudentSubjectsPage | STUDENT | 🚧 Solo mock | Lista de asignaturas del alumno (sin navegación posterior) |
| `*` | Navigate → /login | — | ✅ | Redirección por defecto |

---

## Estado de vistas y componentes

### LoginPage ✅ FUNCIONAL
- Estado interno: `email`, `password`, `error`, `loading`, `showPassword`
- Toggle mostrar/ocultar contraseña
- Manejo de errores con i18n
- Redirección post-login según rol (PROFESSOR → `/professor/subjects`, STUDENT → `/student/subjects`)
- **Data**: Mock (`VITE_MOCK_API=true`) o API real
- **localStorage escribe**: `scde_token`, `scde_token_refresh`, `scde_user`

### ProfessorSubjectsPage ✅ FUNCIONAL (mock + real)
- Llama `getMySubjects()` en modo real; consume `user.subjects` del mock.
- Grid de asignaturas con colores rotatorios y contador de stats.
- Navega a `ProfessorExamsPage` pasando el UUID de la asignatura por router state.
- **Data**: `subjectService.getMySubjects()` o `user.subjects` (mock).

### ProfessorExamsPage ✅ FUNCIONAL (mock + real)
- Recibe UUID de asignatura desde router state (modo real) o código de URL (mock).
- Lista de exámenes con badges de estado.
- **Data**: `examService.getExamsBySubject(subjectId)`.

### ProfessorInstancesPage ✅ FUNCIONAL (mock + real)
- Parámetros de ruta: `:examId` (UUID en modo real).
- Tabla de instancias normalizada (nombre/apellido extraído del email del estudiante).
- Avatares, stats (total/corregidas), filas clickeables.
- **Data**: `instanceService.getInstancesByExam(examId)` + `normalizeInstance`.

### ProfessorCorrectionPage ✅ FUNCIONAL (mock + real)
- Parámetros de ruta: `:instanceId`.
- En modo real: Promise.all de `getInstance` + `downloadInstancePdf` + `preloadAnnotationsToLocalStorage`.
- Botón "Finalizar": llama `syncAnnotations()` (localStorage → backend) + `transitionInstance()`.
- Input de calificación 0-10 con validación.
- **Data**: `instanceService`, `annotationService`, PDF vía Blob URL.

### PdfViewer + PdfCanvas ✅ FUNCIONAL
- Props de `PdfViewer`: `pdfUrl`, `author`, `instanceId`.
- Carga PDF con `pdf.js`; canvas superpuesto para anotaciones.
- Toolbar: pen, eraser, colores, grosores, undo, clear page, add comment, save.
- Navegación multipágina.
- Coordenadas relativas 0-1 (nunca píxeles absolutos).
- **Data**: `localStorage` (`scde_annotations_{instanceId}`), preloaded desde backend al entrar.

### StudentSubjectsPage 🚧 SOLO MOCK
- Grid de asignaturas (idéntico al del profesor).
- Sin llamada a `getMySubjects()` — usa solo `user.subjects` del mock.
- Botón "Ver exámenes" sin navegación implementada.
- **Pendiente**: integrar `getMySubjects()` + crear vistas de resultados del alumno.

---

## Contextos y hooks

### AuthContext

```javascript
{
  user: {
    firstName, lastName, nia, email,
    role,       // 'PROFESSOR' | 'STUDENT'
    subjects    // array de asignaturas
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
  addStroke: (page, points, color, width) => void,
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
  timestamp: number,
  author:    string
}
```

**Formato de persistencia** (`scde_annotations_{instanceId}`):
```javascript
{
  instanceId:   number,
  author:       string,  // email del profesor
  savedAt:      timestamp,
  textComment:  string,
  strokes:      Stroke[]
}
```

---

## Servicios y utilidades

### `/services/apiClient.js` ✅ NUEVO

Cliente base HTTP con interceptores JWT e auto-refresh de tokens.

| Función | Tipo | Descripción |
|---------|------|-------------|
| `apiRequest(endpoint, options)` | async | Core fetch wrapper con auth |
| `apiGet(endpoint, options)` | async | Helper GET |
| `apiPost(endpoint, body, options)` | async | Helper POST |
| `apiPatch(endpoint, body, options)` | async | Helper PATCH |
| `apiDelete(endpoint, options)` | async | Helper DELETE |
| `getAuthHeaders()` | sync | Devuelve `{ Authorization: "Bearer ..." }` |

**Características:**
- Lee JWT de `localStorage.scde_token`
- Auto-refresh: en 401, intenta refrescar y reintenta la petición
- Extrae códigos de error simbólicos del backend (`INVALID_CREDENTIALS`, `VALIDATION_ERROR`, etc.)
- En fallo de refresh, limpia localStorage y redirige a `/login`

### `/services/authService.js` ✅ NUEVO

Wrapper de autenticación que soporta modo mock y API real.

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

### `/services/userService.js` ✅ NUEVO

CRUD de usuarios (listo para Fase 1 del backend).

| Función | Entrada | Salida |
|---------|---------|--------|
| `getUsers(params)` | `{ page, page_size, search, is_active }` | `{ count, page, pageSize, totalPages, results }` |
| `getUser(id)` | UUID o number | User object |
| `createUser(data)` | User data | Created user |
| `updateUser(id, updates)` | UUID, partial data | Updated user |
| `deleteUser(id)` | UUID | void |
| `changePassword(id, data)` | UUID, { current_password, new_password } | void |

**Características:**
- Paginated list con filtros opcionales
- En modo mock: devuelve lista vacía (users no en mockData aún)
- Normaliza nombres de campos (first_name → firstName)
- UUIDs y numeric IDs soportados transparentemente

### `/services/index.js` ✅ NUEVO

Exportador central de todos los servicios.

### `api/authService.js` (heredado)

Mantiene lógica mock original para compatibilidad. **No usar en código nuevo** — usar `/services/authService.js` en su lugar.

### `api/mockData.js`

| Función | Entrada | Salida |
|---------|---------|--------|
| `getExamsBySubject(code)` | `MAT101`, `FIS101`… | `Exam[]` |
| `getExamById(examId)` | number | `Exam \| undefined` |
| `getInstancesByExam(examId)` | number | `Instance[]` |
| `getStatusMeta(status)` | string | `{ label, color, bg }` |

**Estados de examen**: `PENDING`, `CORRECTED`, `REVIEW_REQUESTED`, `CLOSED`

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

---

## Datos mock vs. API real

| Dato | Origen | Estado |
|------|--------|--------|
| Autenticación | `/services/authService` (mock/real por `VITE_MOCK_API`) | ✅ Funcional |
| Clientes HTTP | `/services/apiClient` con JWT + auto-refresh | ✅ Funcional |
| Gestión usuarios | `/services/userService` (listo para Fase 1) | ✅ Funcional |
| Usuarios mock | `MOCK_USERS` en `/api/mockData` | ✅ Mock |
| Asignaturas | `user.subjects` (del auth mock) | ✅ Mock |
| Exámenes | `MOCK_EXAMS` en `/api/mockData` | ✅ Mock |
| Instancias | `MOCK_INSTANCES` en `/api/mockData` | ✅ Mock |
| Anotaciones | localStorage | 🚧 Local — pendiente migrar a API |
| PDFs | `/mock-pdfs/*.pdf` (public/) | ✅ Mock |

---

## Flujos de navegación por rol

### PROFESSOR
```
/login
  ↓ login correcto
/professor/subjects          (grid asignaturas)
  ↓ click asignatura
/professor/subjects/:code    (lista exámenes)
  ↓ click examen
/professor/exams/:examId     (tabla instancias/alumnos)
  ↓ click fila alumno
/professor/correction/:instanceId   (PDF + canvas de anotaciones)
  ↓ save → localStorage (pendiente API)
```

### STUDENT
```
/login
  ↓ login correcto
/student/subjects            (grid asignaturas — sin navegación posterior)
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

## Pendientes conocidos

### Módulo profesor (✅ COMPLETO)
- [x] `apiClient.js` con JWT e interceptores + auto-refresh
- [x] `authService.js` wrapper (mock + real API)
- [x] `userService.js` CRUD usuarios
- [x] `subjectService.js` — `getMySubjects()`
- [x] `examService.js` — `getExamsBySubject(subjectId)`
- [x] `instanceService.js` — list, detail, download PDF, transition, normalizeInstance
- [x] `annotationService.js` — list, create, update, syncAnnotations, preload a localStorage
- [x] Todas las páginas del profesor usan servicios reales (flag VITE_MOCK_API)
- [x] Documentación: `DIARIO_DESARROLLO.md`, `FRONTEND_STATE.md` actualizados

### Módulo estudiante (🚧 PENDIENTE)
- [ ] `StudentSubjectsPage`: integrar `getMySubjects()` (igual que profesor, mismo endpoint)
- [ ] `StudentExamsPage`: nueva página — exámenes del estudiante para una asignatura
- [ ] `StudentResultPage`: nueva página — PDF del examen corregido + anotaciones del profesor (lectura)
- [ ] Añadir rutas `/student/subjects/:subjectId` y `/student/exams/:instanceId/result`
- [ ] Los estudiantes ven PDF en modo solo lectura (sin canvas de anotaciones)

### Pendientes técnicos
- [ ] Pruebas de integración: arrancar backend con Docker Compose y probar con `VITE_MOCK_API=false`
- [ ] Gestión de errores mejorada en páginas (actualmente muestran errores mínimos)
- [ ] Eraser en `PdfCanvas` con `globalCompositeOperation: 'destination-out'` (mejora visual)
