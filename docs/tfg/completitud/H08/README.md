# H08 — resultado del alumno al cruzar el cierre de la ventana de revisión (RF-12.2/12.3/16.6)

Antes la vista leía la revisión solo al montarse: una página abierta seguía mostrando el formulario y fallaba
al enviar. Ahora `StudentResultView` vuelve a leer revisión, instancia y solicitudes en `end_date` (+1,5 s) y,
mientras el servidor siga diciendo OPEN (el cierre lo hace Celery Beat con retraso), cada 30 s. El aviso de
"periodo cerrado" es `role=status`. Test: `results.test.jsx` (temporizadores simulados).

Con Django real (fixture H05, `h08_set_end.py`): se fija `end_date` a +14 s, la página sigue abierta, a los 18 s
aún muestra "Revisión abierta" porque el servidor no ha cerrado; tras `close_review` el siguiente sondeo pasa a
"El periodo de revisión ha terminado" y desaparece el botón de pedir revisión, sin recargar.
Límite honesto: los bytes del PDF ya descargados no se pueden revocar; solo cambia lo que el servidor devuelve
a partir del cierre.
