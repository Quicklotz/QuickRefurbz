@echo off
REM ============================================
REM  QuickRefurbz Station Setup
REM  Run this on each warehouse Windows station
REM ============================================

echo.
echo  QuickRefurbz Station Setup
echo  ==========================
echo.

:prompt
set /p STATION_NUM="Enter station number (1-22): "

REM --- validate input is a number between 1 and 22 ---
set "valid="
for /L %%i in (1,1,22) do (
    if "%STATION_NUM%"=="%%i" set "valid=1"
)

if not defined valid (
    echo.
    echo  ERROR: Please enter a number between 1 and 22.
    echo.
    goto prompt
)

echo.
echo  Configuring station %STATION_NUM% ...
echo.

REM --- run the PowerShell script from the same directory as this bat file ---
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-station.ps1" -StationNumber %STATION_NUM%

echo.
pause
