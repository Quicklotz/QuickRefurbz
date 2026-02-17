# QuickRefurbz Station Setup Script
# Usage: .\setup-station.ps1 -StationNumber 1 -KioskMode $true
# Configures a warehouse PC for station mode with auto-login and optional kiosk lock.

param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1,10)]
    [int]$StationNumber,

    [bool]$KioskMode = $true,

    [string]$ApiBase = "https://quickrefurbz.com/api",

    [string]$AdminPin = "7742"
)

$ErrorActionPreference = "Stop"

$stationId = "STATION-$($StationNumber.ToString('D2'))"
$email = "station${StationNumber}@quicklotz.com"

# Prompt for station password (pre-created via admin panel / seed-stations endpoint)
$securePass = Read-Host "Enter password for $email" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
)

# Create config directory
$configDir = Join-Path $env:APPDATA "QuickRefurbz"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# Write station config
$config = @{
    stationId = $stationId
    email     = $email
    password  = $password
    kioskMode = $KioskMode
    apiBase   = $ApiBase
    adminPin  = $AdminPin
} | ConvertTo-Json -Depth 2

$configPath = Join-Path $configDir "station-config.json"
Set-Content -Path $configPath -Value $config -Encoding UTF8
Write-Host "Station config written to $configPath" -ForegroundColor Green

# Add to Windows auto-start via registry
$exePath = Join-Path $env:ProgramFiles "QuickRefurbz\QuickRefurbz.exe"
if (-not (Test-Path $exePath)) {
    # Try user install path as fallback
    $exePath = Join-Path $env:LOCALAPPDATA "Programs\QuickRefurbz\QuickRefurbz.exe"
}

$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Set-ItemProperty -Path $regPath -Name "QuickRefurbz" -Value "`"$exePath`""
Write-Host "Auto-start registry entry added" -ForegroundColor Green

Write-Host ""
Write-Host "=== Station $StationNumber Setup Complete ===" -ForegroundColor Cyan
Write-Host "  Station ID:  $stationId"
Write-Host "  Email:       $email"
Write-Host "  Kiosk Mode:  $KioskMode"
Write-Host "  Admin Pin:   $AdminPin"
Write-Host "  Auto-start:  Enabled"
Write-Host ""
Write-Host "Reboot or launch QuickRefurbz to start." -ForegroundColor Yellow
