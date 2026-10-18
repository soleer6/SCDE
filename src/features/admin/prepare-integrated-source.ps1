# Crea una copia de compilacion, sin modificar ni fusionar las ramas de trabajo.
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$snapshot = Join-Path $projectRoot 'dist/integrated-source'
$archive = Join-Path $projectRoot 'dist/core-source.zip'

$coreCommit = & git -C $projectRoot rev-parse --verify 'claude/core-flows^{commit}'
if ($LASTEXITCODE -ne 0) { throw 'No se puede identificar la version docente.' }

New-Item -ItemType Directory -Path (Split-Path $snapshot) -Force | Out-Null
& git -C $projectRoot archive --format=zip --output=$archive $coreCommit
if ($LASTEXITCODE -ne 0) { throw 'No se puede exportar la version docente.' }
# El check previo del pipeline limpia dist; una ejecucion directa usa una copia nueva.
if (Test-Path -LiteralPath $snapshot) {
    $snapshot = Join-Path $projectRoot ('dist/integrated-source-' + [guid]::NewGuid().ToString('N'))
}
Expand-Archive -LiteralPath $archive -DestinationPath $snapshot
$codexCommit = & git -C $projectRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'No se puede identificar la version de administracion.' }
@{ claude = $coreCommit; codex = $codexCommit } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $snapshot 'demo-source.json') -Encoding UTF8

$featurePaths = @('src/features/admin', 'src/features/subject-admin', 'src/features/notifications', 'src/features/profile')
# Exportar tambien administracion por SHA: los cambios locales no deben alterar
# una demo identificada como ese commit ni incluir ficheros privados sin seguimiento.
$adminArchive = Join-Path $projectRoot 'dist/admin-source.zip'
& git -C $projectRoot archive --format=zip --output=$adminArchive $codexCommit -- $featurePaths
if ($LASTEXITCODE -ne 0) { throw 'No se pueden exportar los modulos de administracion.' }
Expand-Archive -LiteralPath $adminArchive -DestinationPath $snapshot -Force
# Las dependencias se resuelven desde node_modules del worktree padre.
if ((Get-FileHash (Join-Path $snapshot 'package-lock.json')).Hash -ne (Get-FileHash (Join-Path $projectRoot 'package-lock.json')).Hash) {
    throw 'Las dependencias de ambas versiones difieren; no se reutiliza una instalacion incompatible.'
}
Push-Location -LiteralPath $snapshot
try {
    npm run check | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'La demo conjunta no supera las comprobaciones.' }
} finally {
    Pop-Location
}
Write-Host "Version docente validada: $coreCommit"
return $snapshot
