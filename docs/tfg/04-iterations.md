# 04 · Iteraciones, errores y correcciones

Registro cronológico (2026-10-17). Formato: síntoma → detección → causa → corrección.

| # | Síntoma | Detectado por | Causa | Corrección |
|---|---|---|---|---|
| 1 | `git clone` falla (`early EOF`, `invalid index-pack`) | salida de git | repo backend con binarios grandes; conexión lenta | clon parcial `--filter=blob:none` + sparse checkout |
| 2 | Sparse checkout vacío | `find` tras checkout | Git Bash convirtió `/backend/` en `C:/Program Files/Git/backend/` | `MSYS_NO_PATHCONV=1` |
| 3 | `git ls-tree -l` se cuelga | timeout | `-l` necesita tamaños → descarga blobs en clon parcial | usar API de GitHub para el árbol |
| 4 | 8 errores de lint en la línea base | `npm run lint` | código previo | eliminado al retirar el código legado |
| 5 | Falsos positivos del auditor de estilo (`#000` en máscara; `lib/api` tomado como capa legada; `font-family: var(--serif)`) | `audit:style` | reglas demasiado amplias | regex más precisas + `audit-ignore` explícito |
| 6 | Regla de radio no detectaba nada / detectaba todo | `audit:style` | `\s*` antes del lookahead permite retroceder un espacio | mover `\s*` dentro del lookahead |
| 7 | `react-refresh/only-export-components` | lint | constantes y componentes en el mismo módulo | `model.js` separado |
| 8 | `set-state-in-effect` | lint (react-hooks 7) | `setState` síncrono en efecto al cambiar de instancia | hook `usePdfUrl` con estado indexado por id |
| 9 | `npm install` modificó `package-lock.json` del worktree de Codex | `git status` en su worktree | versión de npm | `git checkout -- package-lock.json` antes de que Codex empezase |
| 10 | Test de flujo falla: `clearRect` de null | Vitest | jsdom no implementa canvas 2D | guarda `if (!ctx) return` (también robustez en navegador) |
| 11 | Tests "Found multiple elements" | Vitest | `<caption>` accesible duplica el título de tabla | consultar por rol `heading` |
| 12 | Tests intermitentes (2/12) dentro de `npm run check` | Vitest bajo carga | timeout de 1 s de Testing Library con dos agentes + dev server en la misma máquina | `asyncUtilTimeout: 8000`, `testTimeout: 30000`; verificado 3 ejecuciones seguidas |
| 13 | **Error de proceso**: se hizo commit con tests rojos | revisión de la salida | la cadena `npm run check …; git commit` no comprobaba el código de salida | commit de corrección inmediato; a partir de ahí el commit se condiciona al resultado |
| 14 | Test de Codex falla solo al unir ramas | `npm run check` en `preview/integration` | el mock `GET /subjects/:id/` (registrado antes) capturaba `GET /subjects/export/` | el router elige la ruta más específica (menos parámetros), como Django con `<uuid:pk>`; test de regresión |
| 15 | Conflicto de merge en `REQUESTS.md` | git | ambos agentes añaden líneas | resolución por unión (fichero de solo añadidos) |
| 16 | **Dirección visual rechazada** ("parece un Binance") | usuario | se copió la paleta/tipografía de la referencia en vez de solo el minimalismo | v2 clara y educativa vía tokens; guía, skill y auditor actualizados |
| 17 | El seed de páginas no se regeneraba entre tests | Vitest (`ingestion.test.jsx`) | `db.reset()` reasignaba solo las tablas del seed base; las de `extendSeed` sobrevivían y el extensor idempotente se saltaba | `reset()` borra todas las tablas antes de reaplicar extensores |
| 18 | Respuesta binaria mock = "[object Blob]" (pedido por Codex) | Vitest | `Response` de Node no entiende el `Blob` de jsdom, que además no tiene `arrayBuffer()` | el router entrega bytes leídos con `FileReader`; test de regresión |
| 19 | Sesión de gestor no reconocida en tests | Vitest | el helper de login guardaba `isStaff: false` fijo | derivar `isStaff` de los claims del JWT, como `AuthProvider` |
| 20 | `POST /orphan-pages/{id}/attach/` inutilizable | lectura de la vista Django | la vista lee `instance_id` de un serializer que solo define `page_id` | usar `POST /instances/{id}/pages/attach/`; gap-5 |

## Iteración 2026-10-18 · incidencias de escaneo (feature `ingestion`)
- Nueva feature `src/features/ingestion`: `/exams/:examId/issues` (identificar estudiante y
  modelo, reordenar, aceptar, mover y descartar páginas, adjuntar huérfanas, crear y borrar
  instancias) y `/scans` para gestores (ingesta manual, motores OCR, páginas sin examen).
- 13 operaciones nuevas cubiertas (instances create/patch/delete, 6 de páginas, orphan-pages,
  engines, ingest). Se descarta a propósito `POST /orphan-pages/{id}/attach/` (gap-5).
- Huecos nuevos documentados: gap-5, gap-6 (`MISSING_PAGE` nunca se limpia), gap-7 (sin
  imagen de página, creación manual con `expected_pages = 0`, `PageResponse` sin fecha).
- Verificación: `npm run check` (27 tests, 4 ficheros; 8 nuevos de la feature), auditoría de
  propiedad OK. Cobertura de la rama claude: 48/94. Sin probar contra backend real.

## Iteración 2026-10-18 · memoria: capítulos 1 y 4
- Redactados en prosa académica los capítulos 1 (motivación, objetivos O1-O6, contexto y
  delimitación frente al TFG de backend, estructura) y 4 (arquitectura con tabla de módulos,
  capa de datos, interacción por actor, sistema visual v1→v2, modelo de anotación).
- Al contrastar el texto con el código se detectó que el autoguardado de anotaciones cancela
  los temporizadores al salir (pérdida de hasta 1,2 s de trazos); se documenta como trabajo futuro.
- `check_tex.py` busca ahora etiquetas en todos los .tex (antes solo en main.tex).

## Iteración 2026-10-18 · zonas de reconocimiento y autoguardado de anotaciones
- Editor de zonas (RF-6.8) en «Modelos y problemas»: perfil por página del PDF en blanco,
  zonas QR/texto/número/casilla con vista previa a escala, réplica en varias páginas
  (`page_numbers`) y borrado. Cubre `GET/POST /models/{id}/page-profiles/`,
  `POST /page-profiles/{id}/zones/` y `DELETE /zones/{id}/` (gap-8 documenta el desajuste
  de la respuesta y el sistema de coordenadas).
- Autoguardado de anotaciones: al cambiar de examen o salir se **ejecutan** los guardados
  pendientes en vez de cancelarlos. El test reveló un segundo fallo: los ids de anotación
  no se reiniciaban al cambiar de instancia y una creación en curso escribía su id en el
  mapa de la instancia nueva (los trazos acababan en el examen anterior). Ahora cada
  guardado usa el mapa de ids de su instancia.
- `coverage.py` reconocía mal `api.upload(..., 'PUT')` y `request(path, { method })`:
  la cobertura real pasa de 48 a 54/94 (Exams 18/18).
- Tests nuevos: `exams/zones.test.jsx` (4) y `grading/useAnnotations.test.jsx` (2).

## Iteración 2026-10-18 · memoria: estado del arte (Codex) y capítulo 3
- Integrados los borradores de Codex del capítulo 2 (2.1-2.5) tras revisarlos: se enlaza 2.1
  con la memoria del backend y con el artículo de Gradescope (Singh et al., 2017); en 2.5 se
  corrige un párrafo desfasado (las carencias de `Dialog`/`Field` que describía ya se
  resolvieron en la base, commit 96fac49). 26 referencias fusionadas en `references.bib`.
- Capítulo 3 redactado: análisis del backend, actores con tabla de permisos, 20 requisitos
  RF-F trazados a etiquetas del contrato, 9 RNF con su comprobación y tabla de huecos gap-1..8.
- Corrección de un dato: el OpenAPI tiene 95 operaciones en 73 rutas (94 sin `/health/`), no
  96 como decía el análisis inicial. Cobertura conjunta medida en ambas ramas: 85/94 desde
  las features + refresh/logout en el cliente común; quedan 7 operaciones sin interfaz.
- `check_tex.py` comprueba ahora que toda cita tiene entrada en `references.bib`.

## Iteración 2026-10-18 · reconocimiento de escritura (OCR) en el corrector
- «Nota a mano» en cada problema de puntuación manual (RF-9.12): el corrector escribe la
  cifra en un panel 2:1; se crea una anotación `STYLUS` con `problem_id` e
  `is_grade_annotation: true` y se llama a `POST /annotations/{id}/ocr-grade/`. Si el
  backend la aplicó (`auto_applied`), la interfaz actualiza la nota conocida (`old_score`);
  si no, ofrece «Usar esta nota», que pasa por el guardado manual. Un intento ilegible se borra.
- «Escribir a mano» en el comentario general (RF-9.13): anotación temporal →
  `POST /annotations/{id}/ocr/` → el texto se añade al comentario y la anotación se borra.
- Decisión: el reconocimiento usa un panel propio y no la tinta de la página, porque el
  renderizador del backend solo entiende listas de puntos en 0-100 y dibujaría en blanco
  el formato de la tinta (gap-9). La tinta de página y la vista del estudiante ignoran
  ahora las anotaciones de los paneles (`isPadAnnotation`, `parseInk`), que antes habrían
  sustituido a la tinta de la página 1.
- Mock: lectura simulada y determinista (nº de trazos; confianza 0,92 hasta 3 trazos y
  0,55 a partir de 4; umbral 0,8 como `GRADE_OCR_CONFIDENCE_THRESHOLD`), y validaciones de
  creación `GRADE_ANNOTATION_REQUIRES_PROBLEM` / `PROBLEM_NOT_IN_MODEL`.
- Cobertura: 56/94 en la rama (Annotations 6/6). Tests nuevos: `grading/ocr.test.jsx` (8).

## Iteración 2026-10-19 · memoria: capítulo 5 (implementación), 6.1 y 6.2
- Redactados 5.1 metodología (fases, condición de cierre, reparto autor/agentes), 5.2
  herramientas (tabla con versiones de `package.json` y del entorno), 5.3 partes críticas con
  cuatro fragmentos de código (`old_score`, autoguardado, conversión de zonas, OCR) más la
  subsección de gestión integrada desde el borrador de Codex (`admin.tex`, versión 40/40),
  5.4 trabajo en paralelo y 5.5 uso de IA; 6.1 estrategia de pruebas.
- Preámbulo: paquete `listings` con lenguaje JavaScript, `cleveref` para `lstlisting`;
  `check_tex.py` reconoce `label={...}` de los listados.
- Comprobado contra el repo antes de consolidar: commit de base `1ebeac9`, rama
  `frontend/base-v2`, tiempos 8 s/30 s, entradas 12-13, auditoría 25 ficheros/28 operaciones,
  modelo de Codex en su configuración.
- 6.2 pruebas: tabla de los 41 casos del núcleo por área y tipo (interfaz/contrato/unitaria),
  tabla resumida de los 91 de gestión (integrado y condensado `06-testing/admin.tex` de Codex),
  batería conjunta de 132 y límites.
- Hallazgo al redactar 5.4: `96fac49` y `REQUESTS.md` decían que `ownership-check.mjs` revisaba
  los cambios sin commitear, pero el script nunca se modificó. Implementado ahora (preparados,
  sin preparar y no rastreados cuando ref = HEAD); probado con un fichero no rastreado ajeno.
- Cobertura conjunta medida (claude bf6e673 + codex 93f4bb2): 87/94 desde features; con
  refresh/logout en el cliente, 89/94. Sin interfaz: POST /organizations/, POST/PATCH/DELETE
  /subjects/ y attach de huérfanas (gap-5, a propósito).
- Pendiente: 6.3-6.5.

## Iteración 2026-10-19 · memoria: capítulo 7 (generalización)
- 7.1 pipeline: 16 etapas en 4 fases (entender el servicio, decidir, construir, verificar e
  integrar) y 3 bucles de realimentación, con evidencia de este registro y de los huecos.
- 7.2 tabla de clasificación D/L/H × G/P y su lectura. Recuento corregido: de los 6
  desajustes del prototipo previo, 3 son de forma y 3 de semántica (las notas decían 5/6).
- 7.3 propuesta de arquitectura (no implementada): plantilla, extractor determinista,
  analista con salida estructurada, generador de preguntas, planificador, agentes por área,
  oráculo e integrador; límites, incluido el de orquestación (varias sesiones del mismo
  agente lanzadas a la vez sobre un worktree el 2026-10-19).
- `check_tex.py` OK. Sin cambios de código.

## Iteración 2026-10-19 · test de contrato del mock contra el OpenAPI real
- Motivo: la validación con el backend real (6.5) sigue sin poder hacerse (Docker Desktop
  parado; la imagen arrastra easyocr, PostgreSQL, Redis y MinIO). Se automatiza la parte
  que no necesita el servidor: que el mock responda lo que declara el contrato.
- `scripts/analyze/openapi-snapshot.mjs` guarda una instantánea JSON recortada del
  OpenAPI (rutas y esquemas, sin prosa ni ejemplos; hash del YAML en el fichero) en
  `src/test/contract/openapi.json`. `validate.js` implementa el subconjunto de OpenAPI 3.0
  que emite drf-spectacular, más estricto en un punto: un campo no declarado es error.
- `mock-contract.test.js` recorre los GET con mock registrado (20 operaciones en la rama),
  rellena los parámetros con ids del seed (uno por estado distinto) y pide cada ruta como
  gestora, dos docentes con roles cruzados y una alumna: 235 respuestas JSON validadas.
- Resultado de la primera pasada (89 violaciones): ninguna era un campo inventado por el
  mock salvo la propuesta conocida de gap-2; dos eran artefactos del propio test (una ruta
  literal emparejada con `:id`, descarga de PDF con `fetch` relativo bajo jsdom) y el
  resto, respuestas por rol que el OpenAPI no declara → **gap-10**, confirmado leyendo las
  vistas Django. Las formas reales se transcriben en `backend-shapes.js`; el test falla si
  una deja de hacer falta.
- Error propio detectado al verificar: el recorte de la instantánea eliminaba las
  *propiedades* llamadas `description` (lo trataba como prosa) → falsos positivos en
  `rubric_criteria`. Corregido antes del commit.
- Comprobación de que el test detecta fallos: añadir un campo a `problemOut` lo hace fallar.
- Fuera de alcance (futuro): validar también cuerpos de petición (las respuestas de
  escritura se validan desde la iteración siguiente).

## Iteración 2026-10-19 · integración en preview y prueba lenta de ingestion
- `preview/integration` (`0c1f9e5`) = claude `9c0183c` + codex `e884cae`: 136/136 pruebas,
  lint/build sin errores, 0 errores de estilo (7 avisos ya conocidos). El commit nuevo de Codex
  solo toca su bitácora: nada que auditar en código.
- Prueba «identify the student» (9 s observados en batería): instrumentada paso a paso, el flujo
  aislado tarda ~0,8 s (render inicial ~0,37 s; cada interacción ~0,1 s; latencia del mock = 0).
  Los 9 s se debían a contención de CPU con otras sesiones en paralelo, no a la prueba.
- Se separó la comprobación del enlace desde la página del examen en su propia prueba, de modo
  que cada prueba monta una única ruta perezosa. Se probó también precargar los chunks en
  `beforeAll` y se descartó: no produjo mejora medible (3 ejecuciones de la batería).

## Iteración 2026-10-19 · test de contrato de las mutaciones
- Motivo: el test de contrato solo cubría GET (los cuerpos de escritura solo tienen sentido
  dentro de un flujo). Codex había añadido `POST/PATCH/DELETE /subjects/` sin validar.
- Diseño: en vez de inventar peticiones, las pruebas de flujo son las muestras. El router de
  mocks expone `observeMockResponses`; `src/test/setup.js` registra cada respuesta a
  POST/PUT/PATCH/DELETE y, al cerrar cada fichero de prueba, falla si alguna se sale de la
  operación declarada (`src/test/contract/mutations.js`, 4 pruebas propias del verificador).
- Primera pasada en la rama: 18 discrepancias distintas. Una era un fallo del mock
  (`page_dimensions: null` al crear un modelo; el backend usa `default=list`) → corregido. El
  resto, comprobadas en el código Django: errores de servicio con códigos y estados no
  declarados, fechas anulables y una lista declarada como objeto → **gap-11**. Los errores se
  validan contra el sobre real del backend; las formas 2xx reales, en `MUTATION_SHAPES`.
- Integración con los mocks de Codex (preview, sin commitear allí): 2 discrepancias (fechas
  nulas de `POST /courses/`, mismo hueco); con ellas declaradas, 151/151.
- Auditoría de Codex `3358890`: incluye el fichero que faltaba en `983c61c`; integración
  `802d77a` = claude `b143bee` + codex `8105edf`, 147/147, lint/build/estilo OK.

## Iteraciones de Codex (resumen de `docs/coordination/codex-log.md`)
- Vitest y el auditor fallaban por `spawn EPERM` en su sandbox → reejecutados con permiso.
- 2 tests con timeout bajo carga → ampliados localmente; entrada de texto con `change`.
- Regresión propia detectada en revisión (editor de permisos recuperaba override antiguo) → corregida con test.
- Varias peticiones a la base (accesibilidad de primitivas, sincronización de sesión) → atendidas por el auditor.

## Comandos usados
```
npm install
npm run dev | npx vite --port 5174           # claude · 5175 preview
npm run lint
npm run test        # vitest run (jsdom, VITE_MOCK_API=true)
npm run build
npm run audit:style
npm run audit:ownership [agent]
npm run check       # lint + test + build + audit:style
python scripts/analyze/endpoints.py <pyyaml> "<SCDEE API.yaml>"
python scripts/analyze/schemas.py   <pyyaml> "<SCDEE API.yaml>" <Schema...>
```

## Métricas al cierre de esta sesión
- Rama claude: 13 tests (flujos: login, panel de examen, contrato de corrección,
  permisos por regla de asignación, anotaciones, resultado del alumno, revisión).
- Unión preview: 30 tests en 7 ficheros, build correcto, 0 errores de estilo.
- No se ha probado contra el backend real (Docker no estaba en marcha).
