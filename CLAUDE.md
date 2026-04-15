# SCDE - Sistema de Corrección Digital de Exámenes

## Proyecto
TFG desarrollado en UAM. Frontend React (este repo) + Backend Django REST (repo del compañero).
Roles: PROFESSOR (anota exámenes), STUDENT (ve resultados).

## Stack
- React + Vite, react-i18next, PDF.js, Canvas API
- JWT auth (mock activo con VITE_MOCK_API=true)
- Dev server: http://localhost:5173

## Convenciones CRÍTICAS
- Campos, roles y valores de API SIEMPRE en inglés (PROFESSOR, STUDENT, etc.)
- Coordenadas de anotaciones en relativas (0-1), nunca píxeles absolutas
- Nunca reescribir componentes que ya funcionan — construir SIEMPRE sobre lo existente
- Mock users: maria.perez@uni.es / prof123 (PROFESSOR), elena.r@estudiante.uni.es / est123 (STUDENT)

## Estructura de anotaciones acordada con backend
{ instanceId, author, savedAt, textComment, strokes: [{ page, points: [{x,y}], color, width, timestamp }] }

## Estado actual
- Login implementado y funcional
- Vistas del profesor iniciadas: asignaturas, instancias de exámenes, instancias resueltas por alumno
- Anotaciones con persistencia en localStorage (pendiente migrar a API)

## Documentación
- docs/FRONTEND_STATE.md — mapa del prototipo actual
- docs/API_CONTRACT.md — contrato de API del backend
- docs/walkthrough/ — explicaciones por módulo
- docs/latex/ — capítulos .tex para memoria TFG

## Git
- Commits siempre firmados como Alejandro, sin mencionar Claude ni IA en los mensajes
- Mensajes de commit en español, estilo convencional (feat:, fix:, chore:, refactor:)
- Ejemplo: "feat: integrar autenticación JWT real con backend Django"
