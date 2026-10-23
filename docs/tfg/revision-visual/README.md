# Revisión visual con navegador real (23/10/2026)

Recorrido con Playwright (`playwright-core`, Edge del sistema en modo headless, sin puerto de
depuración remota) contra la API Django local de `scde-integration` (`:8000`) y Vite en modo real
(`VITE_MOCK_API=false`). Datos sintéticos: `fixtures-claude.local.json` (ventana de revisión
abierta) y `fixtures-claude-closed.local.json` (organización nueva con la ventana ya cerrada).

Repetir (Vite en `http://localhost:5173` con la API real, `playwright-core` instalado fuera del repo):

    node docs/tfg/revision-visual/recorrido.mjs [prefijo]   # SHOTS=<carpeta> para las capturas

El guion inicia sesión por la pantalla de login con cada rol y registra errores de consola,
excepciones y respuestas HTTP >= 400 de la API: el recorrido final no registró ninguno.

## Capturas (`capturas/`)

- `01-docente-*`: inicio con solicitudes asignadas, asignaturas, examen, corrección (y desplazada:
  la barra del visor queda fija bajo la cabecera) y bandeja de revisiones.
- `02-coordinacion-*`: inicio, examen, configuración (modelos/zonas), incidencias con miniaturas de
  páginas escaneadas y ampliación, escaneos y bandeja de revisiones.
- `03-alumno-sin-nota`: examen sin publicar.
- `04-alumno-revision-abierta`: nota, PDF corregido con marca de agua y solicitudes enviadas.
- `05-movil-alumno`: la misma vista a 390 px.
- `06-cerrada-*`: ventana cerrada vista por coordinación, docente, alumno que pidió revisión
  (solicitud pendiente, sin formulario) y alumno que no la pidió (examen cerrado).

## Corregido a raíz del recorrido

- Visor PDF (corrección y alumno): `overflow: hidden` convertía el contenedor en el ámbito de la
  barra `sticky` y dejaba una franja vacía de la altura de la cabecera sobre ella; además la barra
  no se quedaba fija al desplazarse. Ahora `overflow: clip`.
- La página del PDF restaba dos veces el relleno del escenario (salía más estrecha, diminuta en
  móvil). En pantallas estrechas el escenario reduce relleno y altura mínima.
- Formulario de revisión: con todos los problemas ya solicitados mostraba un botón deshabilitado
  "Pedir revisión de 0 problemas"; ahora lo sustituye un aviso.
- `/scans` usaba la rejilla `dm-split` sin importar su CSS: al entrar directamente (chunk perezoso)
  todo quedaba en una columna y los paneles pegados.
- Bandeja de revisiones vacía: aclara que lista los problemas asignados al usuario.

## Observado, pendiente fuera de este carril

- La coordinación no ve solicitudes de revisión en Inicio ni en la bandeja aunque el examen indique
  "Solicitudes 1": `GET /my-tasks/` solo devuelve las de reglas de asignación del usuario
  (petición al backend en `agent-ops/mission/PETICIONES-20261023.md`).
- El editor de zonas dibuja una hoja esquemática: no hay `GET` del PDF en blanco del modelo para
  pintarlo de fondo.
- En la fixture abierta el desglose del alumno sale "—" porque la nota total se fijó sin notas por
  problema (dato sintético, no fallo de la interfaz).
