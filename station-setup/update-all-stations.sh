#!/bin/bash
# ============================================
# Update QuickRefurbz on all Windows stations
# Run from your Mac: ./update-all-stations.sh
# ============================================

STATIONS=(
  # Add station IPs here after setup
  # "192.168.1.201"
  # "192.168.1.202"
  # "192.168.1.203"
)

USER="tech"
PASSWORD="QRfurbz2026!"

if [ ${#STATIONS[@]} -eq 0 ]; then
  echo "No stations configured. Edit this file and add IPs to the STATIONS array."
  exit 1
fi

echo "=== QuickRefurbz Station Updater ==="
echo ""

for IP in "${STATIONS[@]}"; do
  echo "--- Updating $IP ---"
  sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USER@$IP" \
    "powershell -Command \"Invoke-WebRequest -Uri 'https://quickrefurbz.com/downloads/latest.json' -OutFile 'C:\Temp\qr-latest.json'; \$j = Get-Content 'C:\Temp\qr-latest.json' | ConvertFrom-Json; Write-Host ('Current download: ' + \$j.version); Invoke-WebRequest -Uri \$j.url -OutFile 'C:\Temp\QuickRefurbz-Setup.exe'; Start-Process 'C:\Temp\QuickRefurbz-Setup.exe' -ArgumentList '/S' -Wait; Write-Host 'Updated.'\"" 2>&1
  echo ""
done

echo "=== All stations updated ==="
