$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root "assets/characters"
New-Item -ItemType Directory -Force -Path $target | Out-Null

$assets = @(
    @{
        Name = "guard_dog_walker.glb"
        Url = "https://tevy.dev/models/dog-walker/v1/lod0.glb"
        Bytes = 1574900
        Sha256 = "404a67373dcd4200035c04fa9a6fd53b7156ef35397acef7ef9bc2db1d0ed1d5"
    },
    @{
        Name = "prisoner_casual_walker.glb"
        Url = "https://tevy.dev/models/casual-walker/v1/lod0.glb"
        Bytes = 1789516
        Sha256 = "60f7fec2c35fc46b848d99da4c67f43213eea6d8464aa05ac683ffacf2a576d7"
    }
)

foreach ($asset in $assets) {
    $destination = Join-Path $target $asset.Name
    $temporary = "$destination.download"
    if ((Test-Path $destination) -and (Get-Item $destination).Length -eq $asset.Bytes) {
        $existingHash = (Get-FileHash -Algorithm SHA256 $destination).Hash.ToLowerInvariant()
        if ($existingHash -eq $asset.Sha256) {
            Write-Host "Verified cached asset: $($asset.Name)"
            continue
        }
    }

    Write-Host "Downloading $($asset.Name) ..."
    Remove-Item $temporary -ErrorAction SilentlyContinue
    & curl.exe --fail --location --retry 3 --output $temporary $asset.Url
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $temporary)) {
        throw "Download failed: $($asset.Name)"
    }

    $downloaded = Get-Item $temporary
    if ($downloaded.Length -ne $asset.Bytes) {
        throw "Unexpected size for $($asset.Name): $($downloaded.Length) bytes"
    }
    $hash = (Get-FileHash -Algorithm SHA256 $temporary).Hash.ToLowerInvariant()
    if ($hash -ne $asset.Sha256) {
        throw "SHA-256 mismatch for $($asset.Name): $hash"
    }

    Move-Item -Force $temporary $destination
}
Write-Host "AIBOX CC0 humanoid characters are ready." -ForegroundColor Green
