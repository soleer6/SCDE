# Ejecutar desde el worktree: .\src\features\admin\prepare-demo.ps1
# Genera una demo estatica con mocks. No publica, no instala y no modifica Git.
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
    $env:VITE_MOCK_API = 'true'
    npm run build -- --outDir $outputPath
    if ($LASTEXITCODE -ne 0) { throw 'El build de demostracion ha fallado.' }
    if (-not (Test-Path -LiteralPath (Join-Path $outputPath 'index.html'))) { throw 'Falta index.html.' }
    if (Test-Path -LiteralPath (Join-Path $outputPath '404.html')) { throw 'Cloudflare Pages necesita el fallback SPA sin 404.html.' }

    $review = @'
SCDE - Demo de la rama admin-ops con datos ficticios

Esta demo funciona en el navegador sin backend. Los cambios se guardan solo
en el navegador de cada persona. Para restaurar los datos abre /?resetMock.

Gestor: admin@uam.es / admin123
Revisar /admin/users, /admin/courses, /admin/config, /admin/audit,
/admin/subjects, /profile y /notifications.

Coordinacion: maria.perez@uam.es / prof123
Revisar /subjects/s-mat101/manage: miembros, grupos y permisos.

Estudiante: elena.rodriguez@estudiante.uam.es / est123
Revisar /notifications y /profile.

Esta rama no incluye los flujos paralelos ni la integracion de la base visual v2.
Para una revision completa, regenera el ZIP desde la version integrada.

Publicacion manual: Cloudflare Pages > Direct Upload, arrastra este ZIP y
publica el sitio. Comparte la URL pages.dev con el tutor.
https://developers.cloudflare.com/pages/get-started/direct-upload/
'@
    Set-Content -LiteralPath (Join-Path $outputPath 'review.txt') -Value $review -Encoding UTF8
    $assets = @(Get-ChildItem -LiteralPath $outputPath -File -Recurse)
    if ($assets.Count -gt 1000 -or @($assets | Where-Object Length -GT 25MB).Count -gt 0) {
        throw 'El paquete supera los limites documentados de subida directa.'
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
