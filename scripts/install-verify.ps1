<#
.SYNOPSIS
    QuickTestz (QuickRefurbz) - Post-Install Verification
.DESCRIPTION
    Verifies that all components are correctly installed and functional.
    Checks Node.js, build artifacts, CLI, database, and server health.
.PARAMETER InstallDir
    Path to the QuickRefurbz install directory. Auto-detected if not provided.
#>

param(
    [string]$InstallDir = ""
)

$ErrorActionPreference = "Stop"

# ── Resolve install directory ──────────────────────────────────────────────────
if (-not $InstallDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $candidate = Split-Path -Parent $scriptDir
    if (Test-Path (Join-Path $candidate "package.json")) {
        $InstallDir = $candidate
    } else {
        $InstallDir = (Get-Location).Path
    }
}

if (-not (Test-Path (Join-Path $InstallDir "package.json"))) {
    Write-Host "[FAIL] Cannot find package.json in $InstallDir" -ForegroundColor Red
    Write-Host "       Run this script from the QuickRefurbz directory or pass -InstallDir" -ForegroundColor Yellow
    exit 1
}

# ── Configuration ──────────────────────────────────────────────────────────────
$ServerPort = 3001
$totalChecks = 6
$passed      = 0
$failed      = 0
$warnings    = 0

# ── Helpers ────────────────────────────────────────────────────────────────────
function Write-CheckPass {
    param([int]$Num, [string]$Msg)
    Write-Host "  [$Num/$totalChecks] PASS  $Msg" -ForegroundColor Green
    $script:passed++
}
function Write-CheckFail {
    param([int]$Num, [string]$Msg)
    Write-Host "  [$Num/$totalChecks] FAIL  $Msg" -ForegroundColor Red
    $script:failed++
}
function Write-CheckWarn {
    param([int]$Num, [string]$Msg)
    Write-Host "  [$Num/$totalChecks] WARN  $Msg" -ForegroundColor DarkYellow
    $script:warnings++
}

# ── Banner ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  QuickTestz Post-Install Verification" -ForegroundColor Cyan
Write-Host "  Install directory: $InstallDir" -ForegroundColor Gray
Write-Host "  ────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""

# ══════════════════════════════════════════════════════════════════════════════
# Check 1: Node.js >= 20 installed
# ══════════════════════════════════════════════════════════════════════════════
try {
    $nodeVer = & node --version 2>$null
    if ($nodeVer) {
        $majorVer = [int]($nodeVer -replace '^v','').Split('.')[0]
        if ($majorVer -ge 20) {
            Write-CheckPass 1 "Node.js $nodeVer installed (>= v20)"
        } else {
            Write-CheckFail 1 "Node.js $nodeVer is too old (need >= v20)"
        }
    } else {
        throw "no output"
    }
} catch {
    Write-CheckFail 1 "Node.js not found on PATH"
}

# ══════════════════════════════════════════════════════════════════════════════
# Check 2: dist\server.js exists
# ══════════════════════════════════════════════════════════════════════════════
$serverJsPath = Join-Path $InstallDir "dist\server.js"
if (Test-Path $serverJsPath) {
    $size = (Get-Item $serverJsPath).Length
    Write-CheckPass 2 "dist\server.js exists ($([math]::Round($size / 1KB, 1)) KB)"
} else {
    Write-CheckFail 2 "dist\server.js NOT FOUND -- run: npm run build"
}

# ══════════════════════════════════════════════════════════════════════════════
# Check 3: frontend\dist\ exists
# ══════════════════════════════════════════════════════════════════════════════
$frontendDistPath = Join-Path $InstallDir "frontend\dist"
if (Test-Path $frontendDistPath) {
    $fileCount = (Get-ChildItem -Path $frontendDistPath -Recurse -File).Count
    if ($fileCount -gt 0) {
        Write-CheckPass 3 "frontend\dist\ exists ($fileCount files)"
    } else {
        Write-CheckWarn 3 "frontend\dist\ exists but is empty -- run: npm run build:frontend"
    }
} else {
    Write-CheckFail 3 "frontend\dist\ NOT FOUND -- run: cd frontend && npm run build"
}

# ══════════════════════════════════════════════════════════════════════════════
# Check 4: CLI responds to --help
# ══════════════════════════════════════════════════════════════════════════════
$cliPath = Join-Path $InstallDir "dist\enhanced-cli.js"
if (Test-Path $cliPath) {
    try {
        $env:DB_TYPE = "sqlite"
        $helpOutput = & node $cliPath --help 2>&1
        $helpText = $helpOutput -join "`n"
        if ($helpText -match "usage|help|options|commands|quicktestz|quickrefurbz" ) {
            Write-CheckPass 4 "CLI (enhanced-cli.js) responds to --help"
        } elseif ($helpText.Length -gt 0) {
            Write-CheckWarn 4 "CLI produced output but no recognized help text"
        } else {
            Write-CheckFail 4 "CLI produced no output for --help"
        }
    } catch {
        Write-CheckFail 4 "CLI execution failed: $_"
    }
} else {
    Write-CheckFail 4 "dist\enhanced-cli.js NOT FOUND"
}

# ══════════════════════════════════════════════════════════════════════════════
# Check 5: Database initializes
# ══════════════════════════════════════════════════════════════════════════════
$dataDir = Join-Path $env:LOCALAPPDATA "QuickTestz\data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}

try {
    # Try to run a quick database init by importing the server briefly
    $env:DB_TYPE = "sqlite"
    $env:SQLITE_PATH = Join-Path $dataDir "quicktestz-verify.db"

    # Use a node script to test database init
    $dbTestScript = @"
const path = require('path');
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_PATH = '$($env:SQLITE_PATH -replace '\\','\\\\')';
try {
    // Just check if better-sqlite3 can be loaded and create a test db
    const Database = require('better-sqlite3');
    const db = new Database(process.env.SQLITE_PATH);
    db.exec('CREATE TABLE IF NOT EXISTS _verify_test (id INTEGER PRIMARY KEY)');
    db.exec('DROP TABLE _verify_test');
    db.close();
    console.log('DB_OK');
} catch (e) {
    console.error('DB_FAIL: ' + e.message);
    process.exit(1);
}
"@

    $tempScript = Join-Path $env:TEMP "qt-db-verify.cjs"
    Set-Content -Path $tempScript -Value $dbTestScript -Encoding UTF8

    Push-Location $InstallDir
    $dbResult = & node $tempScript 2>&1
    Pop-Location

    $dbOutput = $dbResult -join "`n"
    if ($dbOutput -match "DB_OK") {
        Write-CheckPass 5 "Database initializes successfully (SQLite)"
        # Clean up test db
        Remove-Item $env:SQLITE_PATH -ErrorAction SilentlyContinue
    } else {
        Write-CheckFail 5 "Database init failed: $dbOutput"
    }

    Remove-Item $tempScript -ErrorAction SilentlyContinue
} catch {
    Write-CheckFail 5 "Database verification error: $_"
}

# ══════════════════════════════════════════════════════════════════════════════
# Check 6: Server starts and responds on port 3001
# ══════════════════════════════════════════════════════════════════════════════
$serverProcess = $null
try {
    # Check if a server is already running on the port
    $existingConn = Get-NetTCPConnection -LocalPort $ServerPort -State Listen -ErrorAction SilentlyContinue
    if ($existingConn) {
        Write-Host "       Server already running on port $ServerPort -- testing existing instance" -ForegroundColor Gray
    } else {
        # Start server temporarily
        $env:DB_TYPE = "sqlite"
        $env:NODE_ENV = "production"
        $env:PORT = "$ServerPort"
        $serverProcess = Start-Process -FilePath "node" `
            -ArgumentList "dist\server.js" `
            -WorkingDirectory $InstallDir `
            -PassThru `
            -WindowStyle Hidden `
            -RedirectStandardError (Join-Path $env:TEMP "qt-verify-stderr.log")

        # Wait for server to start
        $maxWait = 10
        $waited = 0
        while ($waited -lt $maxWait) {
            Start-Sleep -Seconds 1
            $waited++
            try {
                $conn = Get-NetTCPConnection -LocalPort $ServerPort -State Listen -ErrorAction SilentlyContinue
                if ($conn) { break }
            } catch {}
        }
    }

    # Test HTTP response
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$ServerPort" `
            -UseBasicParsing `
            -TimeoutSec 10 `
            -ErrorAction Stop

        if ($response.StatusCode -eq 200) {
            Write-CheckPass 6 "Server responds on http://localhost:$ServerPort (HTTP 200)"
        } else {
            Write-CheckWarn 6 "Server responded with HTTP $($response.StatusCode)"
        }
    } catch {
        # Try /api/health or just any response
        try {
            $response2 = Invoke-WebRequest -Uri "http://localhost:$ServerPort/api/health" `
                -UseBasicParsing `
                -TimeoutSec 10 `
                -ErrorAction Stop
            Write-CheckPass 6 "Server responds on http://localhost:$ServerPort/api/health"
        } catch {
            $errMsg = $_.Exception.Message
            if ($errMsg -match "404|401|403|500") {
                # Server is running, just returned an error status
                Write-CheckWarn 6 "Server is running but returned an error: $errMsg"
                $script:passed++
                $script:warnings--
            } else {
                Write-CheckFail 6 "Server did not respond: $errMsg"
            }
        }
    }
} catch {
    Write-CheckFail 6 "Server start/check failed: $_"
} finally {
    # Stop the temp server if we started one
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
        Write-Host "       (Stopped temporary verification server)" -ForegroundColor Gray
    }
}

# ── Summary ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "  Results: $passed passed, $failed failed, $warnings warnings (out of $totalChecks checks)" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "  QuickTestz is ready to use!" -ForegroundColor Green
    Write-Host "  Start the server:  quicktestz-server" -ForegroundColor Gray
    Write-Host "  Open CLI:          quicktestz --help" -ForegroundColor Gray
    Write-Host "  Dashboard:         http://localhost:$ServerPort" -ForegroundColor Gray
} else {
    Write-Host "  Some checks failed. Review the output above and fix issues." -ForegroundColor Yellow
    Write-Host "  Common fixes:" -ForegroundColor Yellow
    Write-Host "    npm run build           Rebuild backend" -ForegroundColor Gray
    Write-Host "    npm run build:frontend  Rebuild frontend" -ForegroundColor Gray
    Write-Host "    npm install             Reinstall dependencies" -ForegroundColor Gray
}

Write-Host ""

# Return exit code based on results
if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
