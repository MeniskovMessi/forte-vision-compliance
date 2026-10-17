# ForteBank Compliance Service — One-Command Backend Startup Script (Rule 1)
$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ForteBank AI Vision Compliance Backend (100% Local Mode)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Ensure models and database are initialized
python scripts/download_models.py
python scripts/init_db.py

Write-Host "`nStarting FastAPI server on http://localhost:8000 (Swagger UI: http://localhost:8000/docs)..." -ForegroundColor Green
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
