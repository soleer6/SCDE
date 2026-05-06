---
name: Backend repo del compañero
description: Estado del repo Django REST de Anxo, dónde está clonado y qué tiene implementado por fase
type: project
---

Repo GitHub: https://github.com/anxoCRuam/SCDEE/tree/backend
Clon local: /tmp/scdee-backend (rama: backend)
Para actualizar: `git -C /tmp/scdee-backend pull` (no clonar de nuevo)

**Why:** Necesario saber exactamente qué endpoints existen antes de conectar el frontend.
**How to apply:** Antes de implementar un nuevo servicio frontend, verificar si el endpoint ya existe en el backend con un grep en /tmp/scdee-backend. Si el clon no existe, hacer pull o clonar de nuevo.

## Estado actual (2026-04-24, Fase 0)

Lo que SÍ está implementado:
- Modelos: User (accounts), Organization — con migraciones
- Infraestructura: Docker, PostgreSQL, Redis, MinIO, Celery
- Health check: GET /health/ (sin auth)
- api_v1.py existe pero urlpatterns VACÍO (todo comentado como "Fase 1:", "Fase 2:")

Lo que NO está implementado aún (API):
- No hay ningún endpoint de negocio registrado
- DEFAULT_AUTHENTICATION_CLASSES = [] (JWT pendiente Fase 1)
- Modelos de courses, exams, instances, annotations, grading: archivos vacíos

## Lo que llegará hoy (mensaje del compañero):
"organizaciones, usuarios, asignaturas, cursos y exámenes" — sin instancias de examen

## Fases planeadas (según api_v1.py comentado):
- Fase 1: auth/, organizations/, users/
- Fase 2: courses/
- Fase 3: subjects/
- Fases posteriores: exams/, instances/, annotations/

## Detalles técnicos importantes:
- Auth: usa PyJWT directo (NO djangorestframework-simplejwt)
- Roles: is_staff=True → PROFESSOR/gestor, is_staff=False → STUDENT
- Tenant: OrganizationMiddleware activo — podría requerir subdomain en login
- PKs: UUID en todos los modelos
- Paginación: offset-based, page_size=25
- User.USERNAME_FIELD = "email"
- User tiene campo `nia` (número de identificación del alumno)
