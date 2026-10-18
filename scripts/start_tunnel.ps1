# PRISM Compliance System — Start ngrok Public Tunnel
$ErrorActionPreference = "Continue"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " PRISM ForteBank — Public ngrok Tunnel for Jury Evaluation" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check if ngrok is available
$ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokCmd) {
    Write-Host "[ERROR] ngrok is not found on PATH!" -ForegroundColor Red
    Write-Host "Please install ngrok or add it to your PATH." -ForegroundColor Yellow
    exit 1
}

# 2. Check if port 8000 is listening
$portListening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $portListening) {
    Write-Host "[NOTICE] Backend is not currently active on port 8000." -ForegroundColor Yellow
    Write-Host "Launching backend in a separate terminal window..." -ForegroundColor Gray
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\start_backend.ps1"
    Start-Sleep -Seconds 5
} else {
    Write-Host "[OK] Backend is active and running on http://localhost:8000" -ForegroundColor Green
}

Write-Host "`nStarting ngrok tunnel on port 8000 (serving BOTH Web UI and API)..." -ForegroundColor Cyan
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "-> Web UI URL:      https://<YOUR_SUBDOMAIN>.ngrok-free.app/" -ForegroundColor Green
Write-Host "-> API Base URL:    https://<YOUR_SUBDOMAIN>.ngrok-free.app/api/v1" -ForegroundColor Green
Write-Host "-> Swagger Docs:    https://<YOUR_SUBDOMAIN>.ngrok-free.app/docs" -ForegroundColor Green
Write-Host "-> Live Inspector:  http://127.0.0.1:4040" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "COPY THE HTTPS FORWARDING URL AND SUBMIT IT IN THE JURY FORM!" -ForegroundColor Magenta
Write-Host "`n[IMPORTANT] Do NOT close this window or put your laptop to sleep while jury evaluates." -ForegroundColor Red

ngrok http 8000 --host-header=rewrite
