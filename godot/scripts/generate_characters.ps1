$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$generator = Join-Path $root ".aibox-ara3d"
$destination = Join-Path $root "godot/assets/characters"
$repo = "https://github.com/TuriaArt/3d-gen-TU.git"
$commit = "3d78dcad462feeeb64db7fe667a7c34105a10a45"

if (-not (Test-Path (Join-Path $generator ".git"))) {
    if (Test-Path $generator) { Remove-Item -Recurse -Force $generator }
    & git clone --filter=blob:none $repo $generator
    if ($LASTEXITCODE -ne 0) { throw "Could not clone Ara 3D Gen." }
}
& git -C $generator fetch --depth 1 origin $commit
if ($LASTEXITCODE -ne 0) { throw "Could not fetch pinned Ara 3D Gen commit." }
& git -C $generator checkout --detach $commit
if ($LASTEXITCODE -ne 0) { throw "Could not checkout pinned Ara 3D Gen commit." }

if (-not (Test-Path (Join-Path $generator "node_modules/.bin/tsx.cmd"))) {
    Push-Location $generator
    try {
        & npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "Ara 3D Gen dependency installation failed." }
    } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $generator "public/assets/catalog.json")) -or
    -not (Test-Path (Join-Path $generator "public/assets/base.pack")) -or
    -not (Test-Path (Join-Path $generator "vendor/sys/skins"))) {
    Write-Host "Preparing the CC0 MakeHuman data library (first run can download about 420 MB)..." -ForegroundColor Cyan
    Push-Location $generator
    try {
        & npm run setup-assets
        if ($LASTEXITCODE -ne 0) { throw "MakeHuman data preparation failed." }
    } finally { Pop-Location }
}
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$tsx = Join-Path $generator "node_modules/.bin/tsx.cmd"
& $tsx (Join-Path $root "tools/aibox-characters/export-character.ts") --generator $generator --params (Join-Path $scriptDir "guard.params.json") --out (Join-Path $destination "guard.glb")
if ($LASTEXITCODE -ne 0) { throw "Guard character export failed." }
& $tsx (Join-Path $root "tools/aibox-characters/export-character.ts") --generator $generator --params (Join-Path $scriptDir "prisoner.params.json") --out (Join-Path $destination "prisoner.glb")
if ($LASTEXITCODE -ne 0) { throw "Prisoner character export failed." }
& node (Join-Path $scriptDir "verify-character-glb.mjs") (Join-Path $destination "guard.glb")
if ($LASTEXITCODE -ne 0) { throw "Guard GLB validation failed." }
& node (Join-Path $scriptDir "verify-character-glb.mjs") (Join-Path $destination "prisoner.glb")
if ($LASTEXITCODE -ne 0) { throw "Prisoner GLB validation failed." }
