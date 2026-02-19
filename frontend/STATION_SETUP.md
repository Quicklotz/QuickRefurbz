# QuickRefurbz Station Setup Guide

How to configure a warehouse workstation to receive automatic app updates.

## Prerequisites

- QuickRefurbz installed (DMG on Mac, NSIS installer on Windows)
- Access to the Quicklotz GitHub organization

## 1. Create a GitHub Personal Access Token

The app is distributed through a private GitHub repo. Each station needs a token to download updates.

1. Go to https://github.com/settings/tokens (log in with an account that has access to `Quicklotz/QuickRefurbz`)
2. Click **Generate new token (classic)**
3. Set a descriptive name, e.g. `quickrefurbz-station-wk13`
4. Set expiration to **No expiration** (or the longest available -- you will need to rotate expired tokens manually)
5. Check the **`repo`** scope (full control of private repositories)
6. Click **Generate token** and copy the value immediately -- it will not be shown again

## 2. Create the Station Config File

Create a JSON file named `station-config.json` in the app's data directory.

**Mac:**
```
~/Library/Application Support/QuickRefurbz/station-config.json
```

**Windows:**
```
%APPDATA%\QuickRefurbz\station-config.json
```

The `%APPDATA%` path is typically `C:\Users\<username>\AppData\Roaming`.

### Quick creation commands

**Mac (Terminal):**
```bash
mkdir -p ~/Library/Application\ Support/QuickRefurbz
cat > ~/Library/Application\ Support/QuickRefurbz/station-config.json << 'EOF'
{
  "stationId": "wk-XX",
  "email": "station@quicklotz.com",
  "password": "STATION_PASSWORD",
  "kioskMode": false,
  "githubToken": "ghp_YOUR_TOKEN_HERE"
}
EOF
```

**Windows (PowerShell):**
```powershell
$dir = "$env:APPDATA\QuickRefurbz"
New-Item -ItemType Directory -Force -Path $dir
@'
{
  "stationId": "wk-XX",
  "email": "station@quicklotz.com",
  "password": "STATION_PASSWORD",
  "kioskMode": false,
  "githubToken": "ghp_YOUR_TOKEN_HERE"
}
'@ | Set-Content "$dir\station-config.json" -Encoding UTF8
```

Replace the placeholder values before saving.

## 3. Config Fields Reference

| Field | Required | Description |
|-------|----------|-------------|
| `stationId` | Yes | Unique station identifier, e.g. `wk-01` through `wk-10` |
| `email` | Yes | QuickRefurbz login email for this station |
| `password` | Yes | QuickRefurbz login password for this station |
| `kioskMode` | Yes | `true` locks the app to fullscreen with no close/devtools; `false` for normal window |
| `githubToken` | Yes* | GitHub PAT with `repo` scope (see step 1). *Not needed if `GH_TOKEN` or `GITHUB_TOKEN` is set as an environment variable. |
| `apiBase` | No | Override the API server URL. When set, auto-updates are disabled. |
| `adminPin` | No | PIN code to unlock kiosk mode at runtime |

### Token resolution order

The app checks for a GitHub token in this order:

1. `GH_TOKEN` environment variable
2. `GITHUB_TOKEN` environment variable
3. `githubToken` field in `station-config.json`

If none are found, auto-updates will silently fail (the app still works, it just cannot pull updates from the private repo).

## 4. Verify Updates Are Working

1. Launch QuickRefurbz
2. Open the app log to check for updater messages:
   - **Mac:** `~/Library/Logs/QuickRefurbz/main.log`
   - **Windows:** `%APPDATA%\QuickRefurbz\logs\main.log`
3. If there is a newer release on GitHub, the app will show an "Update available" notification in the UI
4. If the log shows `Auto-updater error: 401` or `HttpError: 404`, the token is missing or invalid
5. If the log shows `Update not available`, the station is already on the latest version

### Manual check

You can also verify the token works by testing it against the GitHub API:

```bash
curl -s -H "Authorization: token ghp_YOUR_TOKEN" \
  https://api.github.com/repos/Quicklotz/QuickRefurbz/releases/latest \
  | grep tag_name
```

A successful response shows the latest release tag. A `404` or `401` means the token is invalid or lacks access.

## 5. Deploying to Multiple Stations

For bulk setup, use the same `githubToken` across all stations (one PAT is fine for read-only update checks). Only `stationId` needs to differ per machine.

Example station IDs: `wk-01`, `wk-02`, ..., `wk-10`.

### Recommended workflow

1. Create one GitHub PAT for all stations
2. Prepare a template `station-config.json` with the shared token
3. On each machine, copy the template and change only `stationId`
4. Install the app from the latest DMG/EXE
5. Launch and confirm the update check passes (see step 4)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No update prompt ever appears | Token missing or invalid | Check `station-config.json` exists and `githubToken` is set |
| `401 Unauthorized` in logs | Token expired or revoked | Generate a new PAT and update the config |
| `404 Not Found` in logs | Token lacks `repo` scope, or wrong repo | Regenerate with `repo` scope checked |
| App launches but no config loaded | Config file in wrong directory or malformed JSON | Verify path and run `json_pp < station-config.json` to validate |
| Updates download but fail to install on Windows | Antivirus blocking NSIS installer | Add QuickRefurbz to the antivirus exclusion list |
