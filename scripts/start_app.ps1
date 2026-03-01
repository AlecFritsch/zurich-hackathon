# Startet Backend + Frontend (ohne Robot Bridge)
$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path "$PSScriptRoot\..").Path

Write-Host "=== Havoc App Start ===" -ForegroundColor Cyan

# Backend (neues Fenster)
Write-Host "`n[1/2] Starte Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:CAMERA_DEVICE_ID='0'; cd '$projectRoot\havoc'; python -m uvicorn main:app --host 0.0.0.0 --port 8000"

Start-Sleep -Seconds 3

# Frontend (neues Fenster)
Write-Host "[2/2] Starte Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\havoc\hmi'; npm run dev"

Write-Host "`nBackend: http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
