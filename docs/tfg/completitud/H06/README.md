# H06 (parcial) — comentarios de audio (RF-10.1–10.4, 10.6)

`grading/AudioNotes.jsx`: el docente graba (MediaRecorder, si hay micrófono) o sube un archivo de audio;
se envía como multipart `annotation_type=AUDIO` + `file` (no por JSON). Se listan con reproductor
(`download_url` prefirmada) y el autor puede eliminar el suyo. El alumno los escucha en su resultado
cuando `can_view_annotations` lo permite (403 = oculto). Errores del servidor con texto propio:
NO_AUDIO_DATA, AUDIO_FORMAT_UNREADABLE/UNSUPPORTED, AUDIO_DURATION_EXCEEDED (límite de la organización).

Verificado con Edge + Django real (fixture H04): un fichero que no es audio se rechaza con mensaje y no crea
nada; un WAV válido se guarda, el reproductor apunta a bytes RIFF descargables, persiste tras recargar y se
elimina. La grabación con micrófono real no se ha probado en headless (queda el botón y la ruta de subida).
Pendiente de H06: comentarios de texto por página/posición/problema y gestión individual de textos.
