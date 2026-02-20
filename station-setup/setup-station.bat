@echo off
:: ============================================
:: QuickRefurbz Station Setup
:: Double-click to run. Will ask for Admin rights.
:: ============================================

:: Self-elevate to Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator access...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo =============================================
echo   QuickRefurbz Station Setup
echo =============================================
echo.
set /p STATION_NUM="Enter station number (1-10): "
set STATION_NAME=TECH%STATION_NUM%
set USERNAME=tech
set PASSWORD=QRfurbz2026!

echo.
echo Setting up %STATION_NAME%...
echo.

:: 1. Rename computer
echo [1/6] Setting hostname to %STATION_NAME%...
wmic computersystem where name="%COMPUTERNAME%" rename name="%STATION_NAME%" >nul 2>&1
echo   Done.

:: 2. Create tech user
echo [2/6] Creating user '%USERNAME%'...
net user %USERNAME% %PASSWORD% /add /fullname:"QuickRefurbz Tech" /passwordchg:no /expires:never >nul 2>&1
net localgroup Administrators %USERNAME% /add >nul 2>&1
:: Set password to never expire
wmic useraccount where "name='%USERNAME%'" set PasswordExpires=FALSE >nul 2>&1
echo   Done.

:: 3. Enable SSH
echo [3/6] Installing OpenSSH Server...
powershell -Command "Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0" >nul 2>&1
powershell -Command "Start-Service sshd" >nul 2>&1
powershell -Command "Set-Service -Name sshd -StartupType Automatic" >nul 2>&1
powershell -Command "New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -ErrorAction SilentlyContinue" >nul 2>&1
echo   Done.

:: 4. Install Zebra printer driver support
echo [4/6] Detecting printers...
powershell -Command "Get-Printer | Format-Table Name, DriverName, PortName -AutoSize"
echo.

:: 5. Download QuickRefurbz installer
echo [5/6] Downloading QuickRefurbz...
powershell -Command "Invoke-WebRequest -Uri 'https://quickrefurbz.com/downloads/latest.json' -OutFile '%TEMP%\qr-latest.json'"
powershell -Command "$j = Get-Content '%TEMP%\qr-latest.json' | ConvertFrom-Json; Write-Host ('Latest version: ' + $j.version); Invoke-WebRequest -Uri $j.url -OutFile ('%TEMP%\QuickRefurbz-Setup.exe'); Write-Host 'Downloaded.'"
echo   Installing QuickRefurbz...
start /wait "" "%TEMP%\QuickRefurbz-Setup.exe" /S
echo   Done.

:: 6. Get IP and show summary
echo [6/6] Getting network info...
echo.
echo =============================================
echo   SETUP COMPLETE
echo =============================================
echo.
echo   Station:   %STATION_NAME%
echo   User:      %USERNAME%
echo   Password:  %PASSWORD%
echo.
echo   IP Address:
powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' -or $_.PrefixOrigin -eq 'Manual' } | Where-Object { $_.IPAddress -notlike '169.*' }).IPAddress"
echo.
echo   SSH from Mac: ssh tech@[IP above]
echo.
echo   Printers found:
powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"
echo.
echo =============================================
echo.
echo Computer will restart in 30 seconds to apply hostname change.
echo Close this window to cancel restart.
echo.
timeout /t 30
shutdown /r /t 0
