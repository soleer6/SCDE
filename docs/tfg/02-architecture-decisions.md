# 02 · Decisiones de arquitectura

Formato: contexto → decisión → consecuencias. (G) = generalizable a otros backends;
(P) = específica de este proyecto.

### ADR-1 · Registro de features por descubrimiento (G)
- **Contexto**: dos agentes en paralelo; los ficheros compartidos (router, menú, i18n,
  mocks) son el principal punto de conflicto.
- **Decisión**: cada carpeta `src/features/<id>/index.jsx` exporta
  `{ id, order, routes, nav, mocks, i18n, slots }`; `src/app/registry.js` las descubre con
  `import.meta.glob`. Añadir una funcionalidad nunca edita un fichero compartido.
- **Consecuencias**: 0 conflictos de código entre ramas al unirlas (solo uno en un
  documento de registro de añadidos). Un "plugin" de feature es la unidad natural de
  trabajo para un agente generador.

### ADR-2 · Contrato real como única fuente (G)
- **Decisión**: inventario generado del OpenAPI (`API_INVENTORY.md`); prohibido usar
  endpoints o campos ausentes; huecos → `REQUESTS.md` / `03-backend-gaps.md`.
- **Consecuencias**: Codex detectó por sí mismo 4 huecos en lugar de inventar endpoints.

### ADR-3 · Mocks en la capa de transporte con shapes del OpenAPI (G)
- **Decisión**: `VITE_MOCK_API=true` sustituye `fetch` por un router en memoria
  (`src/lib/mock/router.js`). Cada feature registra handlers para sus endpoints y
  devuelve el mismo JSON que el backend (snake_case, decimales como string, paginación).
  Los mocks replican reglas de negocio verificadas en el código (permisos, transiciones,
  concurrencia optimista, ventana de revisión).
- **Consecuencias**: el mismo código de servicios funciona contra mock y backend real;
  los tests de flujo prueban el contrato. Coste: mantener la fidelidad del mock.
  Riesgo detectado: el orden de registro de rutas (ver 04, iteración 6).

### ADR-4 · Sesión = usuario del login + claims del JWT (P, patrón G)
- `is_staff`/`is_superadmin` solo existen en el JWT; se decodifica sin verificar (solo
  para la UI; el backend sigue autorizando). Tokens en `localStorage` con refresco
  *single-flight* y rotación. Trade-off: XSS podría leer tokens; alternativa (cookies
  httpOnly) requiere cambios en el backend.

### ADR-5 · Rol por asignatura, no global (P)
- La vista de `/exams/:id` se elige según `MySubject.role` de esa asignatura
  (docente → panel; estudiante → resultado). `/my-subjects/` se cachea por usuario.

### ADR-6 · Permisos en UI como espejo (G)
- `src/lib/permissions.js` copia `DEFAULT_PERMISSIONS` para mostrar/ocultar acciones.
  Nunca sustituye la autorización del backend; los 403 se muestran con `ErrorState`.

### ADR-7 · Anotaciones: un STYLUS por página + un TEXT general (P)
- El backend guarda anotaciones individuales con payload opaco. Se eligió una
  anotación STYLUS por página (`{v:1, strokes:[...]}`, coordenadas 0-1 y grosor relativo
  al ancho) y una TEXT sin problema como comentario. Autoguardado con *debounce* 1,2 s.
  Alternativa descartada: una anotación por trazo (cientos de peticiones por examen).

### ADR-8 · Caché local de notas conocidas (P, provisional)
- Necesaria por el hueco 1 (no hay lectura de notas por problema). Ver 03.

### ADR-9 · Sistema de diseño por tokens + primitivas congeladas (G)
- `tokens.css` (valores) + `src/ui` (componentes) + auditor determinista de estilo.
- **Validado en la práctica**: el cambio completo de dirección visual v1 → v2 se hizo
  tocando tokens, primitivas y CSS propio; las pantallas de Codex lo heredaron sin
  cambios (su CSS solo tenía 5 reglas de maquetación). Se mantuvieron los nombres v1
  (`--gold*`) como alias para no romper ramas en curso.

### ADR-10 · JS en lugar de TypeScript (P)
- El repo era JS; migrar habría consumido la sesión. Los contratos se documentan con
  JSDoc y el inventario. Candidato claro a mejora (tipos generados del OpenAPI).
