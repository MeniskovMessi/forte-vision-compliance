@echo off
title PRISM ForteBank - ngrok Public Tunnel
echo ============================================================
echo  PRISM ForteBank - Public ngrok Tunnel for Jury Evaluation
echo ============================================================
powershell -ExecutionPolicy Bypass -File "%~dp0start_tunnel.ps1"
pause
