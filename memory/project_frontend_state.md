---
name: Estado del frontend (módulo profesor)
description: Qué vistas y servicios están implementados en el frontend y qué falta
type: project
---

**Why:** Evitar reescribir lo que ya funciona; saber dónde empezar al conectar backend.
**How to apply:** Antes de implementar algo nuevo, verificar este estado para construir sobre lo existente.

## Rutas implementadas (AppRouter.jsx)
- /login → LoginPage ✅
- /professor/subjects → ProfessorSubjectsPage ✅ (mock: user.subjects del AuthContext)
- /professor/subjects/:code → ProfessorExamsPage ✅ (mock: mockData.getExamsBySubject)
- /professor/exams/:examId → ProfessorInstancesPage ✅ (mock: mockData.getInstancesByExam)
- /professor/correction/:instanceId → ProfessorCorrectionPage 🚧 (incompleto, sin nota final)
- /student/subjects → StudentSubjectsPage ✅ (solo grid, sin navegación posterior)

## Servicios existentes (src/services/)
- apiClient.js ✅ — cliente HTTP con JWT interceptors + auto-refresh
- authService.js ✅ — mock/real, mapea is_staff=True → PROFESSOR
- userService.js ✅ — CRUD usuarios con paginación
- index.js ✅ — exportador central
- examService.js ❌ — no existe
- instanceService.js ❌ — no existe
- annotationService.js ❌ — no existe

## Anotaciones
- Guardadas en localStorage como scde_annotations_{instanceId}
- Coordenadas en relativas 0-1 (NUNCA píxeles)
- Estructura: { instanceId, author, savedAt, textComment, strokes: [{page, points, color, width, timestamp}] }
- Hook: useAnnotations.js

## Variables de entorno
- VITE_MOCK_API=true en .env.development → mock activo
- Para conectar backend real: VITE_MOCK_API=false
