<#
.SYNOPSIS
    QuickTestz (QuickRefurbz) - Full Windows Installer
.DESCRIPTION
    Installs all dependencies, builds the project, creates shortcuts,
    and sets up auto-start for the QuickTestz refurbishment system.
.NOTES
    Run from repo root or via install.bat
    Requires Administrator privileges for some operations
#>

$ErrorActionPreference = "Stop"

# ── Configuration ──────────────────────────────────────────────────────────────
$AppName        = "QuickTestz"
$RepoUrl        = "https://github.com/Quicklotz/QuickRefurbz.git"
$NodeVersion    = "20"
$NodeMsiUrl     = "https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi"
$ServerPort     = 3001
$BinDir         = Join-Path $env:LOCALAPPDATA "$AppName\bin"
$DataDir        = Join-Path $env:LOCALAPPDATA "$AppName\data"
$InstallDir     = $null  # set in Step 3

# ── Helpers ────────────────────────────────────────────────────────────────────
function Write-Step {
    param([int]$Step, [string]$Message)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  [$Step/8] $Message" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

function Write-OK   { param([string]$Msg) Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Info { param([string]$Msg) Write-Host "  [..] $Msg" -ForegroundColor Gray }
function Write-Warn { param([string]$Msg) Write-Host "  [!!] $Msg" -ForegroundColor DarkYellow }
function Write-Fail { param([string]$Msg) Write-Host "  [FAIL] $Msg" -ForegroundColor Red }

function Test-Administrator {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ── Banner ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║       QuickTestz - Full Windows Installer           ║" -ForegroundColor Magenta
Write-Host "  ║       Part of the QuickRefurbz Platform             ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

$startTime = Get-Date

# ══════════════════════════════════════════════════════════════════════════════
# [1/8] Check / Install Node.js 20 LTS
# ══════════════════════════════════════════════════════════════════════════════
Write-Step 1 "Checking Node.js $NodeVersion LTS"

$nodeInstalled = $false
try {
    $nodeVer = & node --version 2>$null
    if ($nodeVer) {
        $majorVer = [int]($nodeVer -replace '^v','').Split('.')[0]
        if ($majorVer -ge [int]$NodeVersion) {
            Write-OK "Node.js $nodeVer is already installed (>= v$NodeVersion)"
            $nodeInstalled = $true
        } else {
            Write-Warn "Node.js $nodeVer found but v$NodeVersion+ is required"
        }
    }
} catch {
    Write-Info "Node.js not found on PATH"
}

if (-not $nodeInstalled) {
    Write-Info "Downloading Node.js v$NodeVersion LTS installer..."

    $msiPath = Join-Path $env:TEMP "node-v${NodeVersion}-lts-x64.msi"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $NodeMsiUrl -OutFile $msiPath -UseBasicParsing
        Write-OK "Downloaded Node.js MSI"
    } catch {
        Write-Fail "Failed to download Node.js: $_"
        Write-Host "  Please install Node.js $NodeVersion+ manually from https://nodejs.org" -ForegroundColor Yellow
        exit 1
    }

    Write-Info "Running silent install (may require UAC prompt)..."
    $msiArgs = "/i `"$msiPath`" /qn /norestart"
    try {
        Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -Verb RunAs
        Write-OK "Node.js installed successfully"
    } catch {
        Write-Fail "Node.js installation failed: $_"
        Write-Host "  Try running this script as Administrator, or install Node.js manually." -ForegroundColor Yellow
        exit 1
    }

    # Refresh PATH so node is available in this session
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

    # Verify
    try {
        $nodeVer = & node --version 2>$null
        Write-OK "Verified: Node.js $nodeVer"
    } catch {
        Write-Fail "Node.js still not found after install. You may need to restart your terminal."
        exit 1
    }

    # Clean up MSI
    Remove-Item $msiPath -ErrorAction SilentlyContinue
}

# Also check npm
try {
    $npmVer = & npm --version 2>$null
    Write-OK "npm $npmVer available"
} catch {
    Write-Fail "npm not found. Please reinstall Node.js."
    exit 1
}

# ══════════════════════════════════════════════════════════════════════════════
# [2/8] Check for Visual Studio Build Tools
# ══════════════════════════════════════════════════════════════════════════════
Write-Step 2 "Checking Visual Studio Build Tools (native dependencies)"

$vsWhereExe = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasBuildTools = $false

if (Test-Path $vsWhereExe) {
    $vsInstalls = & $vsWhereExe -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json 2>$null | ConvertFrom-Json
    if ($vsInstalls -and $vsInstalls.Count -gt 0) {
        $hasBuildTools = $true
        Write-OK "Visual Studio Build Tools detected: $($vsInstalls[0].displayName)"
    }
}

if (-not $hasBuildTools) {
    # Check for standalone windows-build-tools via npm
    Write-Warn "Visual Studio Build Tools not detected."
    Write-Info "Some native modules (better-sqlite3, sharp, serialport) require C++ build tools."
    Write-Info "Attempting to install via npm windows-build-tools..."

    try {
        # Try node-gyp approach first
        $env:npm_config_build_from_source = "false"
        Write-Info "Will attempt prebuilt binaries first during npm install."
        Write-Info "If native module builds fail, install Build Tools manually:"
        Write-Host "    https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Cyan
        Write-Host '    Select "Desktop development with C++" workload' -ForegroundColor Cyan
    } catch {
        Write-Warn "Could not set up build tools automatically."
        Write-Info "Install Visual Studio Build Tools manually if npm install fails."
    }
} else {
    Write-OK "Native dependency compilation should work correctly"
}

# ══════════════════════════════════════════════════════════════════════════════
# [3/8] Clone repo or detect existing install
# ══════════════════════════════════════════════════════════════════════════════
Write-Step 3 "Locating QuickRefurbz project"

# Check if we are already inside the repo (install.bat sets location)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$candidateDirs = @(
    (Split-Path -Parent $scriptDir),        # parent of scripts/
    (Get-Location).Path,                     # current directory
    (Join-Path $env:USERPROFILE "QuickRefurbz"),
    (Join-Path $env:USERPROFILE "Desktop\QuickRefurbz")
)

$InstallDir = $null
foreach ($dir in $candidateDirs) {
    if (Test-Path (Join-Path $dir "package.json")) {
        $pkgJson = Get-Content (Join-Path $dir "package.json") -Raw | ConvertFrom-Json
        if ($pkgJson.name -eq "quickrefurbz") {
            $InstallDir = $dir
            Write-OK "Found existing install at: $InstallDir"
            break
        }
    }
}

if (-not $InstallDir) {
    Write-Info "No existing install found. Cloning from $RepoUrl ..."

    $cloneTarget = Join-Path $env:USERPROFILE "QuickRefurbz"
    try {
        $gitVer = & git --version 2>$null
        if (-not $gitVer) { throw "git not found" }

        & git clone $RepoUrl $cloneTarget
        $InstallDir = $cloneTarget
        Write-OK "Cloned to $InstallDir"
    } catch {
        Write-Fail "Git is not installed or clone failed: $_"
        Write-Host "  Install Git from https://git-scm.com/download/win" -ForegroundColor Yellow
        Write-Host "  Or download the repo ZIP and extract to $cloneTarget" -ForegroundColor Yellow
        exit 1
    }
}

Write-OK "Working directory: $InstallDir"

# ══════════════════════════════════════════════════════════════════════════════
# [4/8] Build packages, install deps, build backend + frontend
# ══════════════════════════════════════════════════════════════════════════════
Write-Step 4 "Installing dependencies and building project"

Push-Location $InstallDir

# Set environment for SQLite mode
$env:DB_TYPE = "sqlite"

# -- Build local packages first --
$localPackages = @("packages\database", "packages\api")
foreach ($pkg in $localPackages) {
    $pkgPath = Join-Path $InstallDir $pkg
    if (Test-Path (Join-Path $pkgPath "package.json")) {
        Write-Info "Installing dependencies for $pkg ..."
        Push-Location $pkgPath
        try {
            & npm ci --prefer-offline 2>$null
            if ($LASTEXITCODE -ne 0) {
                & npm install
            }
            # Build if build script exists
            $localPkg = Get-Content "package.json" -Raw | ConvertFrom-Json
            if ($localPkg.scripts -and $localPkg.scripts.build) {
                Write-Info "Building $pkg ..."
                & npm run build
            }
            Write-OK "Package $pkg ready"
        } catch {
            Write-Warn "Issue with $pkg -- continuing: $_"
        } finally {
            Pop-Location
        }
    }
}

# -- Root install --
Write-Info "Running npm ci (root)..."
try {
    & npm ci --prefer-offline 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Info "npm ci failed, falling back to npm install..."
        & npm install
    }
    Write-OK "Root dependencies installed"
} catch {
    Write-Fail "npm install failed: $_"
    exit 1
}

# -- Build backend --
Write-Info "Building backend (TypeScript)..."
try {
    & npm run build
    if (-not (Test-Path "dist\server.js")) {
        throw "dist\server.js not found after build"
    }
    Write-OK "Backend built: dist\server.js"
} catch {
    Write-Fail "Backend build failed: $_"
    exit 1
}

# -- Build frontend --
Write-Info "Building frontend..."
$frontendDir = Join-Path $InstallDir "frontend"
if (Test-Path (Join-Path $frontendDir "package.json")) {
    Push-Location $frontendDir
    try {
        & npm ci --prefer-offline 2>$null
        if ($LASTEXITCODE -ne 0) {
            & npm install
        }
        & npm run build
        if (-not (Test-Path "dist")) {
            throw "frontend\dist\ not created after build"
        }
        Write-OK "Frontend built: frontend\dist\"
    } catch {
        Write-Warn "Frontend build had issues: $_"
        Write-Info "The server may still work without the frontend build."
    } finally {
        Pop-Location
    }
} else {
    Write-Warn "No frontend/package.json found. Skipping frontend build."
}

# -- Create data directory --
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    Write-OK "Created data directory: $DataDir"
}

# -- Create .env if it doesn't exist --
$envFile = Join-Path $InstallDir ".env"
if (-not (Test-Path $envFile)) {
    @"
DB_TYPE=sqlite
SQLITE_PATH=$DataDir\quicktestz.db
PORT=$ServerPort
NODE_ENV=production
"@ | Set-Content -Path $envFile -Encoding UTF8
    Write-OK "Created .env with SQLite config"
} else {
    Write-OK ".env already exists"
}

Pop-Location

# ══════════════════════════════════════════════════════════════════════════════
# [5/8] Create .cmd wrappers in PATH-accessible location
# ══════════════════════════════════════════════════════════════════════════════
Write-Step 5 "Creating CLI wrappers"

if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

# quicktestz-server.cmd -- starts the web server
$serverCmd = @"
@echo off
title QuickTestz Server
echo Starting QuickTestz Server on port $ServerPort ...
set DB_TYPE=sqlite
set NODE_ENV=production
cd /d "$InstallDir"
node dist\server.js %*
"@
Set-Content -Path (Join-Path $BinDir "quicktestz-server.cmd") -Value $serverCmd -Encoding ASCII

# quicktestz.cmd -- the enhanced CLI
$cliCmd = @"
@echo off
set DB_TYPE=sqlite
cd /d "$InstallDir"
node dist\enhanced-cli.js %*
"@
Set-Content -Path (Join-Path $BinDir "quicktestz.cmd") -Value $cliCmd -Encoding ASCII

# quicktestz-menu.cmd -- interactive menu
$menuCmd = @"
@echo off
title QuickTestz Menu
set DB_TYPE=sqlite
cd /d "$InstallDir"
node dist\index.js %*
"@
Set-Content -Path (Join-Path $BinDir "quicktestz-menu.cmd") -Value $menuCmd -Encoding ASCII

Write-OK "Created wrappers in $BinDir"
Write-Info "  quicktestz-server.cmd  - Start the web server"
Write-Info "  quicktestz.cmd         - Enhanced CLI"
Write-Info "  quicktestz-menu.cmd    - Interactive menu"

# Add to user PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$BinDir", "User")
    $env:PATH = "$env:PATH;$BinDir"
    Write-OK "Added $BinDir to user PATH"
    Write-Info "You may need to restart your terminal for PATH changes to take effect."
} else {
    Write-OK "$BinDir is already on PATH"
}

# ══════════════════════════════════════════════════════════════════════════════
# [6/8] Create Desktop + Start Menu shortcuts
# ══════════════════════════════════════════════════════════════════════════════
Write-Step 6 "Creating Desktop and Start Menu shortcuts"

try {
    $WScript = New-Object -ComObject WScript.Shell

    # -- Desktop shortcut: QuickTestz Server --
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $serverShortcutPath = Join-Path $desktopPath "QuickTestz Server.lnk"
    $serverShortcut = $WScript.CreateShortcut($serverShortcutPath)
    $serverShortcut.TargetPath       = Join-Path $BinDir "quicktestz-server.cmd"
    $serverShortcut.WorkingDirectory = $InstallDir
    $serverShortcut.Description      = "Start the QuickTestz refurbishment server on port $ServerPort"
    $serverShortcut.WindowStyle      = 1  # Normal window
    $serverShortcut.Save()
    Write-OK "Desktop shortcut: QuickTestz Server"

    # -- Desktop shortcut: QuickTestz CLI --
    $cliShortcutPath = Join-Path $desktopPath "QuickTestz CLI.lnk"
    $cliShortcut = $WScript.CreateShortcut($cliShortcutPath)
    $cliShortcut.TargetPath       = "cmd.exe"
    $cliShortcut.Arguments        = "/k `"cd /d `"$InstallDir`" && set DB_TYPE=sqlite && echo QuickTestz CLI Ready. Type: quicktestz --help`""
    $cliShortcut.WorkingDirectory = $InstallDir
    $cliShortcut.Description      = "Open QuickTestz CLI terminal"
    $cliShortcut.WindowStyle      = 1
    $cliShortcut.Save()
    Write-OK "Desktop shortcut: QuickTestz CLI"

    # -- Start Menu shortcuts --
    $startMenuDir = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\QuickTestz"
    if (-not (Test-Path $startMenuDir)) {
        New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
    }

    $smServerPath = Join-Path $startMenuDir "QuickTestz Server.lnk"
    $smServer = $WScript.CreateShortcut($smServerPath)
    $smServer.TargetPath       = Join-Path $BinDir "quicktestz-server.cmd"
    $smServer.WorkingDirectory = $InstallDir
    $smServer.Description      = "Start QuickTestz Server"
    $smServer.Save()
    Write-OK "Start Menu shortcut: QuickTestz Server"

    $smCliPath = Join-Path $startMenuDir "QuickTestz CLI.lnk"
    $smCli = $WScript.CreateShortcut($smCliPath)
    $smCli.TargetPath       = Join-Path $BinDir "quicktestz.cmd"
    $smCli.WorkingDirectory = $InstallDir
    $smCli.Description      = "QuickTestz CLI"
    $smCli.Save()
    Write-OK "Start Menu shortcut: QuickTestz CLI"

    # -- Start Menu: Open Dashboard in browser --
    $smDashPath = Join-Path $startMenuDir "QuickTestz Dashboard.lnk"
    $smDash = $WScript.CreateShortcut($smDashPath)
    $smDash.TargetPath  = "http://localhost:$ServerPort"
    $smDash.Description = "Open QuickTestz Dashboard in browser"
    $smDash.Save()
    Write-OK "Start Menu shortcut: QuickTestz Dashboard"

    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($WScript) | Out-Null
} catch {
    Write-Warn "Could not create some shortcuts: $_"
    Write-Info "You can manually create shortcuts to: $BinDir\quicktestz-server.cmd"
}

# ══════════════════════════════════════════════════════════════════════════════
# [7/8] Create Task Scheduler entry for auto-start
# ══════════════════════════════════════════════════════════════════════════════
Write-Step 7 "Setting up auto-start via Task Scheduler"

$taskName = "QuickTestz Server AutoStart"

try {
    # Remove existing task if present
    $existingTask = schtasks /Query /TN "$taskName" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Removing existing scheduled task..."
        schtasks /Delete /TN "$taskName" /F | Out-Null
    }

    # Create the scheduled task to run at user logon
    $cmdPath = Join-Path $BinDir "quicktestz-server.cmd"
    schtasks /Create `
        /TN "$taskName" `
        /TR "`"$cmdPath`"" `
        /SC ONLOGON `
        /RL HIGHEST `
        /F `
        /DELAY 0000:30

    if ($LASTEXITCODE -eq 0) {
        Write-OK "Task '$taskName' created - server starts on login (30s delay)"
    } else {
        throw "schtasks returned non-zero exit code"
    }
} catch {
    Write-Warn "Could not create scheduled task: $_"
    Write-Info "To set up auto-start manually:"
    Write-Host "  1. Open Task Scheduler (taskschd.msc)" -ForegroundColor Cyan
    Write-Host "  2. Create Basic Task > Trigger: At log on" -ForegroundColor Cyan
    Write-Host "  3. Action: Start a program > $cmdPath" -ForegroundColor Cyan

    # Fallback: try Startup folder
    Write-Info "Trying Startup folder as fallback..."
    try {
        $startupDir = [Environment]::GetFolderPath("Startup")
        $startupShortcutPath = Join-Path $startupDir "QuickTestz Server.lnk"
        $WScriptFallback = New-Object -ComObject WScript.Shell
        $startupShortcut = $WScriptFallback.CreateShortcut($startupShortcutPath)
        $startupShortcut.TargetPath       = $cmdPath
        $startupShortcut.WorkingDirectory = $InstallDir
        $startupShortcut.WindowStyle      = 7  # Minimized
        $startupShortcut.Save()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($WScriptFallback) | Out-Null
        Write-OK "Added to Startup folder instead: $startupShortcutPath"
    } catch {
        Write-Warn "Could not add to Startup folder either. Set up auto-start manually."
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# [8/8] Run verification and open browser
# ══════════════════════════════════════════════════════════════════════════════
Write-Step 8 "Running verification and launching"

# Run the verification script if it exists
$verifyScript = Join-Path $InstallDir "scripts\install-verify.ps1"
if (Test-Path $verifyScript) {
    Write-Info "Running post-install verification..."
    try {
        & powershell -ExecutionPolicy Bypass -File $verifyScript -InstallDir $InstallDir
    } catch {
        Write-Warn "Verification script encountered issues: $_"
    }
} else {
    Write-Info "Verification script not found, running inline checks..."

    # Quick sanity checks
    $checks = @(
        @{ Name = "dist\server.js exists";  Test = { Test-Path (Join-Path $InstallDir "dist\server.js") } },
        @{ Name = "frontend\dist\ exists";  Test = { Test-Path (Join-Path $InstallDir "frontend\dist") } },
        @{ Name = "node_modules exists";     Test = { Test-Path (Join-Path $InstallDir "node_modules") } },
        @{ Name = ".env file exists";        Test = { Test-Path (Join-Path $InstallDir ".env") } }
    )

    foreach ($check in $checks) {
        if (& $check.Test) {
            Write-OK $check.Name
        } else {
            Write-Warn "$($check.Name) -- MISSING"
        }
    }
}

# Start the server
Write-Info "Starting QuickTestz server..."
$serverProcess = $null
try {
    $serverProcess = Start-Process -FilePath "node" `
        -ArgumentList "dist\server.js" `
        -WorkingDirectory $InstallDir `
        -PassThru `
        -WindowStyle Minimized `
        -RedirectStandardError (Join-Path $DataDir "server-startup.log")

    # Give server a moment to start
    Start-Sleep -Seconds 4

    if (-not $serverProcess.HasExited) {
        Write-OK "Server is running (PID: $($serverProcess.Id))"

        # Open browser
        Write-Info "Opening dashboard in default browser..."
        Start-Process "http://localhost:$ServerPort"
        Write-OK "Browser opened to http://localhost:$ServerPort"
    } else {
        Write-Warn "Server process exited. Check logs at: $DataDir\server-startup.log"
    }
} catch {
    Write-Warn "Could not auto-start server: $_"
    Write-Info "Start manually: quicktestz-server"
}

# ── Summary ────────────────────────────────────────────────────────────────────
$elapsed = (Get-Date) - $startTime

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  QuickTestz Installation Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  Install location:  $InstallDir" -ForegroundColor White
Write-Host "  Data directory:    $DataDir" -ForegroundColor White
Write-Host "  CLI wrappers:      $BinDir" -ForegroundColor White
Write-Host "  Dashboard:         http://localhost:$ServerPort" -ForegroundColor Cyan
Write-Host "  Database:          SQLite ($DataDir\quicktestz.db)" -ForegroundColor White
Write-Host "  Elapsed time:      $([math]::Round($elapsed.TotalMinutes, 1)) minutes" -ForegroundColor White
Write-Host ""
Write-Host "  Commands available (restart terminal if not found):" -ForegroundColor White
Write-Host "    quicktestz-server    Start the web server" -ForegroundColor Gray
Write-Host "    quicktestz --help    CLI help" -ForegroundColor Gray
Write-Host "    quicktestz-menu      Interactive menu" -ForegroundColor Gray
Write-Host ""
Write-Host "  The server will auto-start on next login." -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
