$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root "assets/characters"
New-Item -ItemType Directory -Force -Path $target | Out-Null

$base = "https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/0128ca510d653bb04d6d1e4885bd8890b5050b4f/public/glb/modular_men"
$assets = @(
    @{ Name = "guard_swat.glb"; Source = "$base/Swat.glb" },
    @{ Name = "prisoner_punk.glb"; Source = "$base/Punk.glb" }
)

foreach ($asset in $assets) {
    $destination = Join-Path $target $asset.Name
    if ((Test-Path $destination) -and (Get-Item $destination).Length -gt 100000) {
        Write-Host "Already present: $($asset.Name)"
        continue
    }
    Write-Host "Downloading $($asset.Name) ..."
    & curl.exe --fail --location --retry 3 --output $destination $asset.Source
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $destination) -or (Get-Item $destination).Length -lt 100000) {
        throw "Failed to download a valid $($asset.Name)"
    }
}
Write-Host "AIBOX character assets are ready." -ForegroundColor Green
