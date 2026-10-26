# H03 — anotaciones de varios autores, 26/10/2026

El lector anterior sobrescribía los trazos de una misma página según qué
descarga acabara última; el autoguardado podía reutilizar el id de otro autor.
El alumno solo veía una de las capas y el primer comentario general.

Ahora cada registro conserva su propia capa de canvas. La última anotación
propia por página, ordenada por fecha e id, es editable; las demás quedan
visibles en solo lectura, incluidas anotaciones antiguas del mismo autor.
La goma no borra tinta de otro registro. Todos los comentarios generales
autorizados se muestran con su autor; el formulario edita únicamente el propio.

Una descarga de contenido fallida ya no se convierte en texto vacío. El fallo
de carga bloquea la edición y ofrece reintento; el fallo de guardado conserva
el borrador en pantalla y permite reenviarlo. Las escrituras se serializan
por instancia/autor; las respuestas tardías no modifican el estado de otra
instancia. Pasar al siguiente examen o marcarlo corregido espera al guardado.

Validación:

- Antes del cambio, las dos regresiones iniciales fallaban; después pasan.
- Nueve pruebas nuevas: autores, registros antiguos/comentarios, lectura fallida,
  borrador/reintento, creación concurrente, fallo tardío al cambiar de instancia,
  solo lectura, navegación bloqueada hasta guardar y visualización completa del alumnado. Se mantienen las dos
  pruebas previas de guardado al abandonar la instancia.
- Cierre: `npm run check` 104 correctas y 3 omitidas preexistentes; lint/build
  correctos, estilo sin errores (7 avisos preexistentes). Propiedad y diff
  correctos antes del commit.
- Edge headless con Django real: dos docentes asignados, capas roja y azul,
  comprobación de píxel antes/después de añadir goma en la capa propia,
  contenidos ajenos idénticos, 503 inyectado solo en el navegador y posterior
  reintento/recarga; segundo docente conserva su comentario. Alumno ve ambas
  capas y comentarios, sin controles de edición. Sin errores de página.
- Vista móvil tras redimensionar a 390 px: se reprodujo desbordamiento del
  visor (730 px); corregido `min-width: 0` en la columna del resultado.
  Recorrido final sin desbordamiento. Capturas incluidas.

La fixture `fixtures-claude-authors.local.json` contiene una organización
sintética nueva, dos correctores y dos estudiantes. El caso de corrección
permanece PENDING_REVIEW; para el alumno se copian las aportaciones sintéticas
al segundo caso IN_REVIEW, evitando publicar o cambiar el ciclo del primero.
No se borran registros, reinicia API ni modifica backend. Credenciales solo
en el directorio local de integración, fuera del repositorio.

Reproducción: copiar los guiones a `%TEMP%/scde-pw`, donde existe
`playwright-core`. Ejecutar `bootstrap_authors.py` en `manage.py shell` dentro
de API con `/runtime` montado al directorio de integración. El guion conserva
una fixture existente. Ejecutar `probe-annotation-access.mjs` para crear el
trazo inicial y reproducir H25; después `authors-real.mjs`, con Vite en
`http://localhost:5173` y `VITE_MOCK_API=false`. El recorrido escribe solo en
esta organización sintética y reutiliza los registros al repetirlo.

Primer recorrido de estudiante descartado: la instancia PENDING_REVIEW con
ventana OPEN no permite ver páginas. Se utilizó la segunda instancia
IN_REVIEW con su propietario y copias sintéticas. Los fallos de arnés y el
desbordamiento móvil no se contabilizan como validación final.

Límites: H03 cierra mezcla/pérdida de capas de autores y recuperación de
errores en la pantalla. No implementa audio ni editor de anotaciones
individuales (H06). No añade bloqueo de edición simultánea de una misma
anotación desde dos sesiones del mismo autor. El borrador se conserva en la
pantalla activa, no se promete recuperación después de cerrar el navegador.

P0 independiente descubierto: H25/#20, un alumno puede listar anotaciones de
otro alumno y descargar su URL aunque el detalle de instancia rechace con 403.
Reproductor incluido, con datos exclusivamente sintéticos. Requiere corrección
backend; este cambio de interfaz no la resuelve ni declara seguro ese endpoint.
