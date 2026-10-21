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

Estas pruebas comprueban perfil y sesión tras cambiar el email, listados de
usuarios/cursos y renovación concurrente de JWT con el cliente HTTP real.
No son una revisión visual de navegador. La batería HTTP adicional comprueba
roles, permisos, importación multipart, notas/conflictos, PDF escaneados,
anotaciones mediante URL firmada con CORS y revocación de refresh tokens.
Su resultado sin credenciales queda en `smoke-results.local.json` del runtime.

## Backend necesario y pendientes

La rama local `fix/integracion-real` de SCDEE corrige el descubrimiento de modelos
(`models/__init__.py` ausentes) y el error 500 de `/courses/current/` para gestores
(`annotate` se estaba llamando sobre una instancia). Incluye regresiones.

El PDF del alumno con `can_download_pages=false` se entrega cifrado, mientras
el visor actual lo trata como PDF plano. La batería confirma el cifrado y su
descifrado real, pero eso **no arregla todavía el visor**: solicitud registrada
en `docs/coordination/REQUESTS.md` para el propietario de corrección/resultados.
También siguen abiertos los huecos conocidos de lectura de notas parciales e
identificadores de problemas para pedir revisión.

La publicación de Vercel sigue siendo una demo simulada: `127.0.0.1` pertenece
al dispositivo que la abre, no al PC del desarrollador. Para usar el backend real
desde el móvil falta alojarlo en una URL HTTPS pública con su configuración de
producción. Este entorno no abre túneles ni publica servicios locales.
