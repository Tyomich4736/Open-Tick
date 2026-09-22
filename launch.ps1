# Launch TickTick Clone (Electron + Vite dev)
# Usage:
#   .\launch.ps1
#   .\launch.ps1 -Seed

[CmdletBinding()]
param(
    [switch]$Seed,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Ensure-NodeOnPath {
    if (Get-Command node -ErrorAction SilentlyContinue) { return }
    $candidates = @(
        'C:\Program Files\nodejs',
        "${env:LOCALAPPDATA}\Programs\node",
        "${env:APPDATA}\nvm"
    )
    foreach ($dir in $candidates) {
        if (Test-Path (Join-Path $dir 'node.exe')) {
            $env:Path = "$dir;$env:Path"
            return
        }
    }
    throw "Node.js not found. Install Node 20 LTS and ensure it is on PATH."
}

Ensure-NodeOnPath

$nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) {
    Write-Warning "Node $(node -v) detected; this project expects Node >= 20."
}

if (-not (Test-Path '.\node_modules')) {
    if ($SkipInstall) {
        throw "node_modules is missing. Run npm install first, or omit -SkipInstall."
    }
    Write-Host 'Installing dependencies...' -ForegroundColor Cyan
    npm install
}

$scriptName = if ($Seed) { 'dev:seed' } else { 'dev' }
Write-Host "Starting TickTick Clone (npm run $scriptName)..." -ForegroundColor Green
npm run $scriptName
