# Startet alles auf diesem Laptop:
# 1. Robot Bridge in Ubuntu WSL (/dev/ttyACM0)
# 2. Havoc Backend

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path "$PSScriptRoot\..").Path
$drive = $projectRoot[0].ToString().ToLower()
$wslPath = "/mnt/$drive" + $projectRoot.Substring(2).Replace('\', '/')
$lerobotDir = "$wslPath/lerobot/lerobot-python"

Write-Host "=== Havoc Start (alles auf diesem Laptop) ===" -ForegroundColor Cyan

# 1. Robot Bridge in Ubuntu WSL starten (neues Fenster)
Write-Host "`n[1/2] Starte Robot Bridge in Ubuntu WSL..." -ForegroundColor Yellow
Start-Process wsl -ArgumentList "-d", "Ubuntu", "-e", "bash", "-c", "export PATH=`"`$HOME/.local/bin:`$PATH`" && cd `"$lerobotDir`" && uv run python robot_bridge.py; exec bash"
Start-Sleep -Seconds 6

# 2. Havoc starten
Write-Host "`n[2/2] Starte Havoc..." -ForegroundColor Yellow
Set-Location "$projectRoot\havoc"
if (Get-Command uv -ErrorAction SilentlyContinue) {
    uv run uvicorn main:app --host 0.0.0.0 --port 8000
} else {
    python -m uvicorn main:app --host 0.0.0.0 --port 8000
}
