# Auditoría de completitud — 26/10/2026

Lista canónica: `C:/Users/aleja/dev/agent-ops/mission/HUECOS-TFG.md`.
Incluye los 131 subrequisitos del apéndice funcional original del backend y
24 bloques priorizados por rol/pantalla. No certifica el TFG al 100 %.

## H02 — notas negativas por problema

RF-11.1 permite notas negativas; RF-11.3 limita a cero el total. El backend ya
lo implementaba, pero el formulario y el mock rechazaban negativos y el mock
sumaba sin mínimo. Ahora ambos aceptan penalizaciones y conservan el máximo
del problema. La rúbrica muestra `-2` y el error desaparece al restaurar una
nota válida ya guardada.

- Regresión reproducida antes de corregir: se esperaba -1,5 persistido y no
  existía ninguna nota. Después: dos pruebas nuevas de nota manual y rúbrica,
  con recarga limpia, suma mixta y recuperación del error.
- `npm run check`: 95 pruebas correctas, 3 omitidas preexistentes; lint/build
  correctos; estilo sin errores (7 advertencias preexistentes).
- `npm run audit:ownership` y `git diff --check`: correctos.
- Edge headless + Vite `http://localhost:5173` + Django real `:8000`:
  docente asignado guarda -12, total 0; recarga recupera -12; guarda -1,5 con
  coma, total 8,5 junto al criterio +10; 11 se rechaza sin PUT; restaurar
  -1,5 limpia el error. Sin errores de página. Captura `negative-real.png`.

Se creó una organización sintética nueva, separada de todas las existentes.
Credenciales solo en `%LOCALAPPDATA%/SCDE/integration/fixtures-claude-negative.local.json`.
Los guiones no contienen credenciales. No se borraron registros, reinició API,
editó backend ni tocó el otro carril.

## Reproducción

El backend debe estar activo. Para preparar la fixture nueva, ejecutar
`bootstrap_negative.py` en `manage.py shell` dentro del contenedor API,
con `/runtime` montado al directorio local de integración. Si la fixture
existe, el guion la conserva. `assign-negative.mjs` concede al docente de
esa fixture su segundo problema mediante la API, de forma idempotente.

Copiar los guiones `.mjs` a `%TEMP%/scde-pw` (donde ya está instalado
`playwright-core`). Arrancar Vite con `VITE_MOCK_API=false` en localhost:5173
(origen admitido por CORS). Ejecutar `assign-negative.mjs` y después
`negative-real.mjs`. La prueba escribe solo notas de su organización sintética;
no cambia el estado del examen ni publica notas. No repetir en una fixture
ajena.

Primer intento del arnés descartado por CORS en puerto 5181; segundo por regla
de corrección ausente para el problema nuevo; tercero corrigió la suposición
del seed (total 8 informativo sin Grade real). Se añadió la asignación mediante
API y se seleccionó el criterio +10 antes del recorrido. Los intentos fallidos
no se contabilizan como validación.

Próximo bloque: H03, separar anotaciones de distintos autores y ofrecer
recuperación de errores. H01 depende del contrato de permisos propios; H07/H10
están solicitados al propietario backend (#14/#16).
