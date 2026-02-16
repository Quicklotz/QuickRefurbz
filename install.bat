@echo off
REM ╔══════════════════════════════════════════════════════════════╗
REM ║  QuickTestz (QuickRefurbz) - Windows Installer Launcher    ║
REM ║  This wrapper launches the full PowerShell installer.       ║
REM ╚══════════════════════════════════════════════════════════════╝

title QuickTestz Installer

echo.
echo   QuickTestz Installer
echo   ====================
echo.
echo   Launching PowerShell installer...
echo.

REM Resolve the directory this batch file lives in
set "SCRIPT_DIR=%~dp0"

REM Check if the PowerShell script exists
if not exist "%SCRIPT_DIR%scripts\install-windows-full.ps1" (
    echo   [ERROR] Cannot find scripts\install-windows-full.ps1
    echo   Make sure you are running this from the QuickRefurbz directory.
    echo.
    pause
    exit /b 1
)

REM Launch PowerShell with execution policy bypass
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\install-windows-full.ps1"

REM Capture exit code
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% NEQ 0 (
    echo.
    echo   [!] Installation encountered errors (exit code: %EXIT_CODE%).
    echo   Review the output above for details.
) else (
    echo.
    echo   Installation complete!
)

echo.
echo   Press any key to close this window...
pause >nul
exit /b %EXIT_CODE%
