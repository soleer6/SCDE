# Notas para la generalización agéntica

Pregunta guía: *¿qué partes del proceso seguido para construir este frontend podrían
convertirse en un sistema genérico backend-repository → frontend?*

Leyenda: **D** determinista (sin LLM) · **L** razonamiento de LLM/agente ·
**H** requiere interacción humana · **P** específico del proyecto · **G** generalizable.

## Pipeline observado y clasificación

| Paso | Qué se hizo aquí | Tipo | Notas para automatizar |
|---|---|---|---|
| 1. Obtener el backend | clon parcial + sparse por la API de árboles de GitHub | D, G | heurística "excluir binarios > N KB"; fallback ante `early EOF` |
| 2. Localizar el contrato | `docs/files/spectacular/*.yaml` | D/L, G | buscar `openapi:` en yaml/json; si no hay, generarlo (drf-spectacular, FastAPI…) |
| 3. Inventario de endpoints y schemas | `endpoints.py`, `schemas.py` | D, G | ya automatizado; base de cualquier generador |
| 4. Verificar comportamiento no expresado en el schema | lectura de vistas/servicios: permisos, transiciones, visibilidad, concurrencia | L, G | el schema no dice *quién* ve *qué* ni *cuándo*: es el paso de más valor del LLM |
| 5. Modelo de actores y permisos | roles por asignatura, `DEFAULT_PERMISSIONS`, staff bypass | L (extracción) + D (tabla), G | salida estructurada: actores × recursos × acciones × permiso |
| 6. Máquina de estados del recurso central | `VALID_TRANSITIONS` | D si es una tabla en código; L si está dispersa, G | genera rails de estado y botones de transición |
| 7. Detectar huecos del contrato | gap-1 (lectura de notas), gap-2 (ids para alumnos) | L, G | método: para cada acción de cada actor, ¿hay un endpoint *visible para ese actor* que dé cada dato de entrada? Si no → hueco |
| 8. Preguntas al usuario | estética, nota de aprobado, prioridades, qué hacer con huecos | H, G | generar preguntas solo para lo que cambia el producto (ver lista abajo) |
| 9. Especificación de frontend | rutas por actor, vistas por variante de visibilidad, estados vacío/carga/error/403 | L, G | plantilla: recurso → lista / detalle / acción |
| 10. Plan y reparto entre agentes | features por grupos de endpoints con dependencias mínimas | L, G | grafo endpoints ↔ features; cortar por componentes conexos |
| 11. Base común antes de paralelizar | tokens, primitivas, cliente API, router de mocks, registro de features | D (plantilla) + L, G | casi todo es plantilla reutilizable; solo cambian los valores de auth/paginación/errores |
| 12. Mocks fieles al contrato | handlers con shapes del OpenAPI + reglas de negocio | D (shapes) + L (reglas), G | los shapes pueden generarse del schema; las reglas requieren el paso 4 |
| 13. Implementación por feature | páginas, servicios, i18n | L, P/G | la feature-plugin es la unidad de trabajo de un agente |
| 14. Verificación | lint, tests, build, auditor de estilo, auditor de propiedad | D, G | todo determinista; es el "oráculo" del bucle de reparación |
| 15. Integración y revisión | rama preview, tests sobre la unión | D + L, G | la unión detectó un fallo que ninguna rama veía por separado |
| 16. Revisión estética | rechazo de v1 por el usuario | H, P | no automatizable sin feedback humano o capturas + criterio |

## Qué sería plantilla y qué no
- **Plantilla reutilizable (G)**: `src/lib/api` (cliente con refresh y errores simbólicos),
  `src/lib/mock/router.js`, `src/app/registry.js`, `src/ui`, scripts de auditoría,
  scripts de análisis del OpenAPI, `OWNERSHIP.json` + `ownership-check`.
- **Parametrizable**: nombres de campos de tokens, formato de paginación, formato de
  errores, claims del JWT. Todo esto salió del OpenAPI + 3 ficheros de código.
- **Específico (P)**: anotaciones sobre PDF, modelo de rúbricas, ventana de revisión,
  la estética.

## Preguntas que un sistema genérico debería hacer al humano
1. ¿Qué actor y flujo son prioritarios?
2. Referencias visuales: ¿qué eje te gusta de cada una (estructura, color, tipografía, tono)?
3. Reglas de negocio ausentes en el backend (aquí: nota de aprobado).
4. Para cada hueco del contrato: ¿esperar al backend, mitigar en cliente o descartar?
5. ¿Se puede ejecutar el backend real (Docker, datos semilla) para validar?

## Lecciones (con evidencia)
- El schema no basta: 5 de los 6 desajustes del frontend previo eran sobre semántica
  (rol por asignatura, claims, visibilidad), no sobre forma.
- "No inventar endpoints" + inventario generado = el segundo agente documentó 4 huecos
  en vez de improvisar.
- Las referencias visuales son ambiguas: preguntar por el eje habría evitado una
  iteración completa de estilo (iteración 16).
- Las sospechas de fallo de seguridad deben verificarse en el código antes de
  documentarse (se descartó una supuesta fuga multi-tenant leyendo el manager).
- El auditor determinista atrapa reglas; la coherencia visual real necesita una
  captura revisada (no disponible en esta sesión: sin navegador automatizable).
- Los verificadores deben condicionar el commit (iteración 13).
