# Crea una copia de compilacion, sin modificar ni fusionar las ramas de trabajo.
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$coreWorktree = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '../SCDE-claude'))
$snapshot = Join-Path $projectRoot 'dist/integrated-source'
$archive = Join-Path $projectRoot 'dist/core-source.zip'

$coreStatus = & git -C $coreWorktree status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'No se puede consultar el worktree de los flujos docentes.' }
if ($coreStatus) { throw 'Hay cambios locales en los flujos docentes. No se publica una copia incompleta.' }
$coreCommit = & git -C $coreWorktree rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'No se puede identificar la version docente.' }
$branch = & git -C $coreWorktree branch --show-current
if ($branch -ne 'claude/core-flows') { throw 'El worktree docente no esta en la rama esperada.' }

New-Item -ItemType Directory -Path (Split-Path $snapshot) -Force | Out-Null
& git -C $coreWorktree archive --format=zip --output=$archive $coreCommit
if ($LASTEXITCODE -ne 0) { throw 'No se puede exportar la version docente.' }
# El check previo del pipeline limpia dist; una ejecucion directa usa una copia nueva.
if (Test-Path -LiteralPath $snapshot) {
    $snapshot = Join-Path $projectRoot ('dist/integrated-source-' + [guid]::NewGuid().ToString('N'))
}
Expand-Archive -LiteralPath $archive -DestinationPath $snapshot

$featurePaths = @('src/features/admin', 'src/features/subject-admin', 'src/features/notifications', 'src/features/profile')
$files = & git -C $projectRoot ls-files -- $featurePaths
if ($LASTEXITCODE -ne 0) { throw 'No se pueden enumerar los modulos de administracion.' }
foreach ($file in $files) {
    $destination = Join-Path $snapshot $file
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $destination
}
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
