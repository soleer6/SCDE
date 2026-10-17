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
