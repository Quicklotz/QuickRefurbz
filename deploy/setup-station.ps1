#Requires -Version 5.1
<#
.SYNOPSIS
    Configure a Windows station for QuickRefurbz auto-login.

.DESCRIPTION
    Creates %APPDATA%\QuickRefurbz\station-config.json with credentials
    for the given station number. The QuickRefurbz app reads this file
    on startup to bypass the login screen.

.PARAMETER StationNumber
    Station number (1-22). Will be zero-padded to two digits.

.EXAMPLE
    .\setup-station.ps1 -StationNumber 3
    # Creates config for station RFB-03 / station03@quickrefurbz.com
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateRange(1, 22)]
    [int]$StationNumber
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------- derived values ----------
$padded   = $StationNumber.ToString('D2')          # "03"
$stationId = "RFB-$padded"
$email     = "station${padded}@quickrefurbz.com"
$password  = "refurbz${padded}!"

# ---------- target paths ----------
$configDir  = Join-Path $env:APPDATA 'QuickRefurbz'
$configFile = Join-Path $configDir   'station-config.json'

# ---------- create directory ----------
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    Write-Host "[OK] Created directory: $configDir"
} else {
    Write-Host "[OK] Directory already exists: $configDir"
}

# ---------- build config object ----------
$config = [ordered]@{
    stationId = $stationId
    email     = $email
    password  = $password
    kioskMode = $false
    apiBase   = ''
}

# ---------- write JSON ----------
$json = $config | ConvertTo-Json -Depth 1
Set-Content -Path $configFile -Value $json -Encoding UTF8

Write-Host ""
Write-Host "============================================"
Write-Host "  QuickRefurbz Station Config Written"
Write-Host "============================================"
Write-Host "  Station ID : $stationId"
Write-Host "  Email      : $email"
Write-Host "  Password   : refurbz${padded}!"
Write-Host "  Kiosk Mode : false"
Write-Host "  Config File: $configFile"
Write-Host "============================================"
Write-Host ""
Write-Host "Restart the QuickRefurbz app to auto-login."
