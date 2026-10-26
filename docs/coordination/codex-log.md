# Codex log

(Codex: append entries — date, task, decisions, errors found, fixes, commands + results.)
# 26/10/2026 — tarea #15, sustitución del motor en el carril core

El puente asignó expresamente SCDE-claude/claude/core-flows a este turno.
Se respetó esa asignación: backend y SCDE-codex se leyeron únicamente.
Auditoría de 131 RF y 24 bloques en mission/HUECOS-TFG.md; peticiones al otro
carril en PETICIONES-20261026.md. H02 corregido: negativos manuales, mínimo
cero del total en mock, signo de criterios negativos y recuperación de error.
Evidencia, errores del arnés y próximos pasos en docs/tfg/completitud/README.md.
Sin modificaciones de memoria académica, borrados ni reinicios de API.
# 26/10/2026 — #15/H03, capas y recuperación de anotaciones

En SCDE-claude por asignación explícita del usuario: corregidas capas por autor
y registro, selección estable del id editable propio, comentarios completos,
cola de guardado por instancia/autor, errores de carga/guardado con reintento
y navegación que espera al guardado. Regresión móvil del visor corregida.
104 pruebas correctas/3 omitidas previas; Edge/Django real con dos docentes,
alumno, comprobación de píxel y 503/reintento, más móvil 390 px sin overflow.
Detalle, limitaciones y guiones en docs/tfg/completitud/H03/README.md.

Descubierto/reproducido P0 backend H25 (lectura de anotaciones de otro alumno),
petición y tarea #20 creadas. Además encolados #21–#25 para H01/H09 y carencias
administrativas/OCR/verificación interna. Backend y otro carril intactos.
Confirmado en remoto el push anterior de claude/core-flows bd3f99d.
