@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or is not available in PATH.
  echo Run Install.bat after installing Node.js LTS.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not installed or is not available in PATH.
  echo Run Install.bat after reinstalling Node.js LTS with npm enabled.
  pause
  exit /b 1
)

if "%PORT%"=="" set "PORT=5173"
if "%HOST%"=="" set "HOST=0.0.0.0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-server.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Server stopped with an error.
)
pause
