param(
    [string]$BackendPath = 'C:\Users\aleja\dev\SCDEE-backend\backend',
    [string]$RuntimePath = (Join-Path $env:LOCALAPPDATA 'SCDE/integration')
)
$ErrorActionPreference = 'Stop'
$BackendPath = (Resolve-Path -LiteralPath $BackendPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $BackendPath 'manage.py'))) { throw 'Falta el backend Django.' }
New-Item -ItemType Directory -Path $RuntimePath -Force | Out-Null
$RuntimePath = (Resolve-Path -LiteralPath $RuntimePath).Path
$config = Join-Path $RuntimePath '.env.local'
if (-not (Test-Path -LiteralPath $config)) {
    $values = @{
        SCDEE_BACKEND_PATH = $BackendPath.Replace('\', '/')
        SCDE_INTEGRATION_DOCKERFILE = (Join-Path $PSScriptRoot 'Dockerfile').Replace('\', '/')
        SCDE_RUNTIME_PATH = $RuntimePath.Replace('\', '/')
        SCDE_DB_PASSWORD = [guid]::NewGuid().ToString('N')
        SCDE_STORAGE_PASSWORD = [guid]::NewGuid().ToString('N')
        SCDE_DJANGO_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
        SCDE_ENCRYPTION_KEY = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    }
    $lines = $values.GetEnumerator() | ForEach-Object { $_.Key + '=' + $_.Value }
    [System.IO.File]::WriteAllLines($config, $lines, [System.Text.UTF8Encoding]::new($false))
}
$compose = Join-Path $PSScriptRoot 'compose.yml'
function Compose {
    # Windows PowerShell turns native stderr progress into terminating errors
    # when its caller redirects streams. The native exit code remains binding.
    $ErrorActionPreference = 'Continue'
    & docker compose --env-file $config -f $compose @args
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'Fallo del entorno de integración; consulta el diagnóstico de Docker.' }
}
& docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop debe estar arrancado.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'bootstrap.py') -Destination (Join-Path $RuntimePath 'bootstrap.py')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'integration_settings.py') -Destination (Join-Path $RuntimePath 'integration_settings.py')
Compose up -d --build db redis minio mailpit api
Compose exec -T api python manage.py migrate --noinput
Compose exec -T api python manage.py shell -c "exec(open('/runtime/bootstrap.py').read())"
Compose up -d worker
Write-Output "API real: http://127.0.0.1:8000. Credenciales de prueba solo en $RuntimePath/fixtures.local.json"
