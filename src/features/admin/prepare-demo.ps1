# Ejecutar desde el worktree: .\src\features\admin\prepare-demo.ps1
# Genera una demo conjunta con mocks. No publica, no instala y no modifica Git.
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist/tutor-demo'))
$zipPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist/scde-tutor-demo.zip'))
$allowedRoot = $projectRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
foreach ($target in @($outputPath, $zipPath)) {
    if (-not $target.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'La salida debe permanecer dentro de este worktree.'
    }
}

$previousMock = [System.Environment]::GetEnvironmentVariable('VITE_MOCK_API', 'Process')
Push-Location -LiteralPath $projectRoot
try {
    $sourceRoot = & (Join-Path $PSScriptRoot 'prepare-integrated-source.ps1')
    $env:VITE_MOCK_API = 'true'
    Push-Location -LiteralPath $sourceRoot
    try {
        npm run build -- --outDir $outputPath --emptyOutDir
    } finally {
        Pop-Location
    }
    if ($LASTEXITCODE -ne 0) { throw 'El build de demostracion ha fallado.' }
    if (-not (Test-Path -LiteralPath (Join-Path $outputPath 'index.html'))) { throw 'Falta index.html.' }
    if (Test-Path -LiteralPath (Join-Path $outputPath '404.html')) { throw 'La demo SPA no debe incluir un 404.html estatico.' }
    Copy-Item -LiteralPath (Join-Path $sourceRoot 'demo-source.json') -Destination (Join-Path $outputPath 'demo-source.json')

    # La plantilla compartida aun conserva theme-color de v1. Ajustar solo el artefacto.
    $tokens = Get-Content -Raw -LiteralPath (Join-Path $sourceRoot 'src/styles/tokens.css')
    $background = [regex]::Match($tokens, '--bg:\s*(#[0-9a-fA-F]+)\s*;').Groups[1].Value
    if (-not $background -or $background -eq '#07080a') { throw 'La demo no contiene la base visual educativa.' }
    $indexPath = Join-Path $outputPath 'index.html'
    $index = [System.IO.File]::ReadAllText($indexPath)
    $index = $index -replace '(<meta name="theme-color" content=")[^"]+', ('$1' + $background)
    [System.IO.File]::WriteAllText($indexPath, $index, [System.Text.UTF8Encoding]::new($false))

    $review = @'
SCDE - Demo conjunta con estilo educativo v2 y datos ficticios

Esta demo funciona en el navegador sin backend. Los cambios se guardan solo
en el navegador de cada persona. Para restaurar los datos abre /?resetMock.

Gestor: admin@uam.es / admin123
Revisar /admin/users, /admin/courses, /admin/config, /admin/audit,
/admin/subjects, /profile y /notifications.

Coordinacion: maria.perez@uam.es / prof123
Revisar /subjects/s-mat101/manage: miembros, grupos y permisos.

Estudiante: elena.rodriguez@estudiante.uam.es / est123
Revisar /notifications y /profile.

Incluye la version confirmada de claude/core-flows (estilo educativo v2,
asignaturas, examenes y correccion) y los modulos de administracion.
Es una copia de compilacion validada; las ramas no se han fusionado.

La publicacion y las actualizaciones se gestionan desde el PC mediante
src/features/admin/deploy-vercel.ps1, con la sesion autorizada de Vercel.
'@
    Set-Content -LiteralPath (Join-Path $outputPath 'review.txt') -Value $review -Encoding UTF8
    $assets = @(Get-ChildItem -LiteralPath $outputPath -File -Recurse)
    if ($assets.Count -gt 1000 -or @($assets | Where-Object Length -GT 25MB).Count -gt 0) {
        throw 'El paquete supera el presupuesto de archivos de esta demo.'
    }
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $archive = $null
    try {
        $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
        foreach ($asset in $assets) {
            $entryName = $asset.FullName.Substring($outputPath.Length).TrimStart('\', '/').Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $asset.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally {
        if ($archive) { $archive.Dispose() }
        $stream.Dispose()
    }
    Get-Item -LiteralPath $zipPath | Select-Object FullName, Length
} finally {
    [System.Environment]::SetEnvironmentVariable('VITE_MOCK_API', $previousMock, 'Process')
    Pop-Location
}
