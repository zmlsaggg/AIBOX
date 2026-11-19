$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js 22.12+ is required. Install the LTS release from https://nodejs.org/ and run this script again." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$nodeVersion = (node -p "process.versions.node").Trim()
try {
    $parsedNodeVersion = [version]$nodeVersion
} catch {
    throw "Could not parse Node.js version: $nodeVersion"
}
if ($parsedNodeVersion -lt [version]"22.12.0") {
    Write-Host "Node.js 22.12 or newer is required. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js $nodeVersion" -ForegroundColor Cyan
Write-Host "Installing Browser Bridge dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

Write-Host "Checking the Chromium browser used by the bridge..." -ForegroundColor Cyan
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Playwright Chromium installation failed." }

Write-Host ""
Write-Host "Starting AIBOX Browser Bridge. Keep this PowerShell window open." -ForegroundColor Green
Write-Host "Copy the value printed after 'Pairing token:' into the AIBOX game." -ForegroundColor Green
Write-Host "Do not share that token." -ForegroundColor Yellow
npm start
