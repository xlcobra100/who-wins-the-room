@echo off
title Halcyon Council
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo.
echo   Halcyon Council: http://localhost:5180
echo   (Ollama should be running for the local GPU engine.)
echo.

call npm run dev -- --open
pause
