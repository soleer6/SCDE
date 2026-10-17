# Publica y actualiza la demo usando la sesion persistente de Vercel CLI.
# No instala dependencias ni hace push/merge. La autorizacion inicial es vercel login.
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$outputPath = Join-Path $projectRoot 'dist/tutor-demo'
$statePath = Join-Path $PSScriptRoot 'vercel-project.local'
$deploymentPath = Join-Path $PSScriptRoot 'vercel-deployment.local'
$cli = (Get-Command vercel.cmd -ErrorAction Stop).Source

Push-Location -LiteralPath $projectRoot
try {
    & $cli whoami --non-interactive
    if ($LASTEXITCODE -ne 0) { throw 'Vercel requiere autorizacion inicial: vercel login.' }

    npm run check
    if ($LASTEXITCODE -ne 0) { throw 'No se publica: check ha fallado.' }
    npm run audit:ownership
    if ($LASTEXITCODE -ne 0) { throw 'No se publica: audit:ownership ha fallado.' }

    & (Join-Path $PSScriptRoot 'prepare-demo.ps1')
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vercel-demo.json') -Destination (Join-Path $outputPath 'vercel.json')

    $linkDirectory = Join-Path $outputPath '.vercel'
    $linkFile = Join-Path $linkDirectory 'project.json'
    if (Test-Path -LiteralPath $statePath) {
        New-Item -ItemType Directory -Path $linkDirectory -Force | Out-Null
        Copy-Item -LiteralPath $statePath -Destination $linkFile
    } else {
        & $cli link --cwd $outputPath --yes --project scde-tutor-admin-ops --non-interactive
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear o vincular el proyecto de Vercel.' }
        Copy-Item -LiteralPath $linkFile -Destination $statePath
    }

    $json = & $cli deploy $outputPath --prod --yes --non-interactive --json
    if ($LASTEXITCODE -ne 0) { throw 'El despliegue de Vercel ha fallado.' }
    $deployment = ($json -join "`n") | ConvertFrom-Json
    if (-not $deployment.url) { throw 'Vercel no ha devuelto una URL verificable.' }
    $baseUrl = if ($deployment.url -match '^https://') { $deployment.url } else { 'https://' + $deployment.url }

    # Public checks deliberately do not reuse CLI credentials or bypass deployment protection.
    foreach ($route in @('/', '/admin/users', '/notifications', '/profile')) {
        $response = Invoke-WebRequest -Uri ($baseUrl.TrimEnd('/') + $route) -UseBasicParsing -TimeoutSec 30
        if ($response.StatusCode -ne 200 -or $response.Content -notmatch '<div\s+id="root"') {
            throw "La ruta publica $route no sirve la aplicacion. Comprueba la proteccion de despliegue."
        }
    }
    Set-Content -LiteralPath $deploymentPath -Value ($json -join "`n") -Encoding UTF8
    Write-Output "Despliegue verificado: $baseUrl"
    if ($deployment.alias) { Write-Output ('Dominios asignados: ' + ($deployment.alias -join ', ')) }
} finally {
    Pop-Location
}
