#Requires -Version 5.1
<#
.SYNOPSIS
    Update the Scoop manifest and upload the installer after an Electron build.

.DESCRIPTION
    After electron-builder produces a new Windows .exe installer, this script:
      1. Computes the SHA256 hash of the .exe
      2. Updates scoop/quickrefurbz.json with the new version and hash
      3. Generates a latest.json metadata file alongside the .exe
      4. Uploads the .exe and latest.json to the server at /var/www/quickrefurbz-downloads/

    Designed to run from GitHub Actions (Windows runner) after the build step.

.PARAMETER ExePath
    Path to the built .exe installer file.
    Example: frontend/release/QuickRefurbz-Setup-1.1.1.exe

.PARAMETER Version
    Semantic version string for this release (e.g. 1.1.1).
    If not provided, extracted from the .exe filename.

.PARAMETER ServerHost
    SSH host for uploading the installer. Defaults to the HETZNER_QL_HOST
    environment variable (set in GitHub Actions secrets).

.PARAMETER ServerUser
    SSH user for uploading. Defaults to the HETZNER_QL_USER environment variable.

.PARAMETER RemotePath
    Remote directory for the downloads. Defaults to /var/www/quickrefurbz-downloads.

.PARAMETER SkipUpload
    If set, skip the SCP upload step (useful for local testing).

.EXAMPLE
    .\update-scoop-manifest.ps1 -ExePath "frontend\release\QuickRefurbz-Setup-1.2.0.exe"

.EXAMPLE
    .\update-scoop-manifest.ps1 -ExePath "frontend\release\QuickRefurbz-Setup-1.2.0.exe" -SkipUpload
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateScript({ Test-Path $_ })]
    [string]$ExePath,

    [Parameter(Mandatory = $false)]
    [string]$Version,

    [Parameter(Mandatory = $false)]
    [string]$ServerHost = $env:HETZNER_QL_HOST,

    [Parameter(Mandatory = $false)]
    [string]$ServerUser = $env:HETZNER_QL_USER,

    [Parameter(Mandatory = $false)]
    [string]$RemotePath = '/var/www/quickrefurbz-downloads',

    [Parameter(Mandatory = $false)]
    [switch]$SkipUpload
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------
# Resolve paths
# --------------------------------------------------------------------------
$exeFullPath = Resolve-Path $ExePath
$exeFilename = Split-Path $exeFullPath -Leaf
$repoRoot    = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
# Handle running from deploy/ or from repo root
if (-not (Test-Path (Join-Path $repoRoot 'scoop'))) {
    $repoRoot = Split-Path $PSScriptRoot -Parent
}
$manifestPath = Join-Path $repoRoot 'scoop' 'quickrefurbz.json'

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Update Scoop Manifest" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --------------------------------------------------------------------------
# Step 1: Extract version from filename if not provided
# --------------------------------------------------------------------------
if (-not $Version) {
    if ($exeFilename -match 'QuickRefurbz-Setup-(.+)\.exe$') {
        $Version = $Matches[1]
    } else {
        Write-Error "Could not extract version from filename: $exeFilename. Please provide -Version explicitly."
    }
}

Write-Host "[1/4] Version: $Version" -ForegroundColor Yellow
Write-Host "       Installer: $exeFullPath"

# --------------------------------------------------------------------------
# Step 2: Compute SHA256 hash
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Computing SHA256 hash..." -ForegroundColor Yellow

$hashObj = Get-FileHash -Path $exeFullPath -Algorithm SHA256
$sha256  = $hashObj.Hash.ToLower()

Write-Host "       Hash: $sha256" -ForegroundColor Green

# --------------------------------------------------------------------------
# Step 3: Update the Scoop manifest JSON
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Updating Scoop manifest..." -ForegroundColor Yellow

if (-not (Test-Path $manifestPath)) {
    Write-Error "Scoop manifest not found at: $manifestPath"
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

# Update version
$manifest.version = $Version

# Update architecture.64bit URL and hash
$manifest.architecture.'64bit'.url  = "https://quickrefurbz.com/downloads/QuickRefurbz-Setup-$Version.exe"
$manifest.architecture.'64bit'.hash = $sha256

# Write back with consistent formatting
$json = $manifest | ConvertTo-Json -Depth 10
# Ensure trailing newline
if (-not $json.EndsWith("`n")) { $json += "`n" }
Set-Content -Path $manifestPath -Value $json -Encoding UTF8 -NoNewline

Write-Host "       Updated: $manifestPath" -ForegroundColor Green

# --------------------------------------------------------------------------
# Step 3b: Generate latest.json for autoupdate / checkver
# --------------------------------------------------------------------------
$latestJsonPath = Join-Path (Split-Path $exeFullPath -Parent) 'latest.json'

$latestObj = [ordered]@{
    version  = $Version
    sha256   = $sha256
    filename = "QuickRefurbz-Setup-$Version.exe"
    url      = "https://quickrefurbz.com/downloads/QuickRefurbz-Setup-$Version.exe"
    date     = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
}

$latestJson = $latestObj | ConvertTo-Json -Depth 2
Set-Content -Path $latestJsonPath -Value $latestJson -Encoding UTF8

Write-Host "       Generated: $latestJsonPath" -ForegroundColor Green

# --------------------------------------------------------------------------
# Step 4: Upload to server via SCP
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Uploading to server..." -ForegroundColor Yellow

if ($SkipUpload) {
    Write-Host "       Upload SKIPPED (-SkipUpload flag set)." -ForegroundColor DarkYellow
} else {
    if (-not $ServerHost) {
        Write-Error "ServerHost is not set. Provide -ServerHost or set HETZNER_QL_HOST environment variable."
    }
    if (-not $ServerUser) {
        Write-Error "ServerUser is not set. Provide -ServerUser or set HETZNER_QL_USER environment variable."
    }

    $sshTarget = "${ServerUser}@${ServerHost}"

    # Upload the .exe installer
    Write-Host "       Uploading $exeFilename ..."
    scp -o StrictHostKeyChecking=no "$exeFullPath" "${sshTarget}:${RemotePath}/${exeFilename}"

    # Upload latest.json
    Write-Host "       Uploading latest.json ..."
    scp -o StrictHostKeyChecking=no "$latestJsonPath" "${sshTarget}:${RemotePath}/latest.json"

    # Set permissions on the server
    Write-Host "       Setting file permissions..."
    ssh -o StrictHostKeyChecking=no $sshTarget "chmod 644 ${RemotePath}/${exeFilename} ${RemotePath}/latest.json"

    Write-Host "       Upload complete." -ForegroundColor Green
}

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Manifest Update Complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Version  : $Version"
Write-Host "  SHA256   : $sha256"
Write-Host "  Manifest : $manifestPath"
Write-Host "  latest   : $latestJsonPath"
Write-Host "  Download : https://quickrefurbz.com/downloads/$exeFilename"
Write-Host ""

if (-not $SkipUpload) {
    Write-Host "  Files uploaded to ${ServerHost}:${RemotePath}/"
    Write-Host ""
}

Write-Host "  Next steps:"
Write-Host "    - Commit updated scoop/quickrefurbz.json to the repo"
Write-Host "    - Stations will get the update via: scoop update quickrefurbz"
Write-Host ""
