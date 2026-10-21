# Integración local con el backend real

Entorno aislado de desarrollo: Django del repositorio SCDEE, PostgreSQL, Redis,
MinIO, Celery y Mailpit. No sustituye servicios con mocks ni modifica la memoria
del TFG. Los datos son sintéticos, pero se almacenan y consultan en los servicios
reales. La API y MinIO solo publican puertos en `127.0.0.1`.

Desde la raíz de SCDE-codex:

```powershell
.\src\features\admin\real-backend\start.ps1
node src/features/admin/real-backend/smoke.mjs
```

`start.ps1` admite `-BackendPath` y `-RuntimePath`. Conserva los volúmenes y la
semilla entre ejecuciones: no hace `flush`, elimina datos ni reinicia los estados
del examen. La primera ejecución genera claves aleatorias y cuentas privadas en
`%LOCALAPPDATA%/SCDE/integration`; no se incluyen en Git ni en Vercel.
La batería crea usuarios/anotaciones de prueba y cambia la nota de su propia
instancia sintética. Solo acepta una API de loopback y esa semilla.

La imagen de la API incluye las dependencias reales salvo EasyOCR/PyTorch:
se configura Tesseract y no se da por validada la ingesta OCR. Los modelos
de negocio, autenticación, permisos, almacenamiento y tareas no se sustituyen.
La configuración hereda `scdee.settings.base`, sin dependencias opcionales de
diagramas ni aplicaciones de depuración del entorno del compañero.

MinIO se compila desde la versión oficial fijada
[`RELEASE.2025-10-15T17-29-55Z`](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z),
siguiendo la distribución desde fuentes del proyecto; las antiguas imágenes
oficiales ya no se pudieron descargar. API y MinIO comparten espacio de red para
que las URL firmadas de `127.0.0.1:9000` funcionen desde Django y el navegador.
CORS de MinIO se configura en el servidor, sin `PutBucketCors` (no implementado).

## Pruebas de componentes sin mocks HTTP

Se utiliza una copia de compilación de las dos ramas; no se fusionan ni se
modifican archivos compartidos. Después de confirmar los cambios locales:

```powershell
$source = .\src\features\admin\prepare-integrated-source.ps1
$env:SCDE_INTEGRATED_SOURCE = $source
npx vitest run --config src/features/admin/real-backend/vitest.config.mjs
```

Estas pruebas comprueban perfil/sesión, usuarios/cursos, asignaturas,
grupos/miembros, herencia de permisos, rechazo al alumno, notificaciones y
renovación concurrente de JWT con el cliente HTTP real. Para el caso de
notificaciones hace falta un aviso sintético nuevo sin leer:

```powershell
Get-Content src/features/admin/real-backend/notifications-fixture.py -Raw | docker exec -i scde-integration-api-1 python manage.py shell
```

Ese comando comprueba el tenant de las dos cuentas Codex, crea dos filas
nuevas y no envía correo, elimina datos ni reinicia servicios. Ejecutarlo antes
de cada repetición de componentes; ejecutar el smoke administrativo después
del componente permite que cada uno consuma un aviso diferente si se generan
dos tandas.
No son una revisión visual de navegador. La batería HTTP adicional comprueba
roles, permisos, importación multipart, notas/conflictos, PDF escaneados,
anotaciones mediante URL firmada con CORS y revocación de refresh tokens.
Su resultado sin credenciales queda en `smoke-results.local.json` del runtime.

## Backend necesario y pendientes

La rama local `fix/integracion-real` de SCDEE corrige el descubrimiento de modelos
(`models/__init__.py` ausentes) y el error 500 de `/courses/current/` para gestores
(`annotate` se estaba llamando sobre una instancia). Incluye regresiones.

El propietario corrigió el visor cifrado en `claude/core-flows@323e276`.
La batería HTTP confirma el transporte y su descifrado; la revisión visual
sigue pendiente. Los commits backend `382d9d0` a `e790905` incorporan permisos,
ingesta y contrato. El smoke administrativo exige ahora 403 al consultar
permisos ajenos sin autoridad, y comprueba la consulta por gestión de miembros
sin conceder derecho a PATCH.

`node src/features/admin/real-backend/core-journeys.mjs` comprueba lectura de
nota desde dos sesiones JWT, conflicto sin old_score, ids de problemas,
solicitud de revisión real, persistencia y deduplicación y aislamiento entre
alumnos. Usar después del smoke general que guarda una nota sintética. No
edita ni valida los cambios de backend #1 bloqueados por el guardián: los
resultados solo describen el proceso API ejecutado, que contiene cambios
locales sin commit. Tampoco demuestra hidratación de la pantalla de corrección:
el propietario aún usa localStorage y debe resolver ese recorrido. Evidencia
sin secretos en `core-journeys-results.local`.

La publicación de Vercel sigue siendo una demo simulada: `127.0.0.1` pertenece
al dispositivo que la abre, no al PC del desarrollador. Para usar el backend real
desde el móvil falta alojarlo en una URL HTTPS pública con su configuración de
producción. Este entorno no abre túneles ni publica servicios locales.
