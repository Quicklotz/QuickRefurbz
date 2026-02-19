#Requires -Version 5.1
<#
.SYNOPSIS
    One-shot bootstrap for a fresh Windows warehouse station.

.DESCRIPTION
    Installs Scoop (if missing), adds the Quicklotz Scoop bucket,
    installs QuickRefurbz via Scoop, and configures the station
    for auto-login by delegating to setup-station.ps1.

    Run this script as a normal user (NOT as Administrator).
    Scoop installs to the current user's profile by default.

.PARAMETER StationNumber
    Station number (1-22). Passed through to setup-station.ps1
    to generate station-config.json with auto-login credentials.

.PARAMETER BucketUrl
    URL or local path for the Scoop bucket containing the
    QuickRefurbz manifest. Defaults to the Quicklotz GitHub bucket.

.EXAMPLE
    .\bootstrap-station.ps1 -StationNumber 5
    # Full bootstrap for station RFB-05

.EXAMPLE
    .\bootstrap-station.ps1 -StationNumber 12 -BucketUrl "C:\repo\QuickRefurbz\scoop"
    # Use a local bucket path instead of the remote URL
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateRange(1, 22)]
    [int]$StationNumber,

    [Parameter(Mandatory = $false)]
    [string]$BucketUrl = 'https://github.com/Quicklotz/scoop-quicklotz'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$padded = $StationNumber.ToString('D2')

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  QuickRefurbz Station Bootstrap"           -ForegroundColor Cyan
Write-Host "  Station: RFB-$padded"                     -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$steps = @()

# --------------------------------------------------------------------------
# Step 1: Install Scoop if not already present
# --------------------------------------------------------------------------
Write-Host "[1/4] Checking for Scoop..." -ForegroundColor Yellow

if (Get-Command scoop -ErrorAction SilentlyContinue) {
    Write-Host "       Scoop is already installed." -ForegroundColor Green
    $steps += "Scoop: already installed"
} else {
    Write-Host "       Installing Scoop from get.scoop.sh ..."
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Invoke-RestMethod -Uri 'https://get.scoop.sh' | Invoke-Expression

    # Verify installation
    if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
        # Scoop adds itself to PATH but the current session may not see it yet
        $scoopShim = Join-Path $env:USERPROFILE 'scoop\shims'
        if (Test-Path $scoopShim) {
            $env:PATH = "$scoopShim;$env:PATH"
        }
    }

    if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
        Write-Error "Scoop installation failed. Please install manually: https://scoop.sh"
    }

    Write-Host "       Scoop installed successfully." -ForegroundColor Green
    $steps += "Scoop: freshly installed"
}

# --------------------------------------------------------------------------
# Step 2: Add the Quicklotz Scoop bucket
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Adding Quicklotz Scoop bucket..." -ForegroundColor Yellow

$existingBuckets = scoop bucket list 2>&1 | Out-String

if ($existingBuckets -match 'quicklotz') {
    Write-Host "       Bucket 'quicklotz' is already added." -ForegroundColor Green
    $steps += "Bucket: already present"
} else {
    # If BucketUrl is a local path, add it directly; otherwise use the Git URL
    if (Test-Path $BucketUrl -ErrorAction SilentlyContinue) {
        # Local bucket: Scoop can add a local directory as a bucket
        scoop bucket add quicklotz $BucketUrl
    } else {
        scoop bucket add quicklotz $BucketUrl
    }
    Write-Host "       Bucket 'quicklotz' added from: $BucketUrl" -ForegroundColor Green
    $steps += "Bucket: added from $BucketUrl"
}

# --------------------------------------------------------------------------
# Step 3: Install (or update) QuickRefurbz
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Installing QuickRefurbz..." -ForegroundColor Yellow

$installed = scoop list 2>&1 | Out-String

if ($installed -match 'quickrefurbz') {
    Write-Host "       QuickRefurbz is already installed. Updating..." -ForegroundColor Green
    scoop update quickrefurbz
    $steps += "QuickRefurbz: updated"
} else {
    scoop install quicklotz/quickrefurbz
    Write-Host "       QuickRefurbz installed." -ForegroundColor Green
    $steps += "QuickRefurbz: freshly installed"
}

# --------------------------------------------------------------------------
# Step 4: Configure station auto-login
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Configuring station auto-login..." -ForegroundColor Yellow

# Locate setup-station.ps1 relative to this script
$setupScript = Join-Path $PSScriptRoot 'setup-station.ps1'

if (-not (Test-Path $setupScript)) {
    # Fallback: look in the same directory as the running script
    $setupScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) 'setup-station.ps1'
}

if (Test-Path $setupScript) {
    & $setupScript -StationNumber $StationNumber
    $steps += "Station config: RFB-$padded configured"
} else {
    Write-Warning "setup-station.ps1 not found at: $setupScript"
    Write-Warning "Skipping station config. Run setup-station.ps1 manually after bootstrap."
    $steps += "Station config: SKIPPED (setup-station.ps1 not found)"
}

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Bootstrap Complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

foreach ($step in $steps) {
    Write-Host "  [OK] $step" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Station RFB-$padded is ready."
Write-Host "  Launch QuickRefurbz from the Start Menu or desktop shortcut."
Write-Host ""
Write-Host "  To update later:  scoop update quickrefurbz"
Write-Host "  To uninstall:     scoop uninstall quickrefurbz"
Write-Host ""
