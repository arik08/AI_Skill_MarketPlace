@echo off
setlocal

cd /d "%~dp0"

echo.
echo [AI Skill Marketplace] Installing required packages...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or is not available in PATH.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not installed or is not available in PATH.
  echo Reinstall Node.js LTS with npm enabled and run this file again.
  pause
  exit /b 1
)

echo Node:
node --version
echo npm:
call npm --version
echo.

call npm install
if errorlevel 1 (
  echo.
  echo [ERROR] Package installation failed.
  pause
  exit /b 1
)

echo.
echo [OK] Installation completed.
echo Run run.bat to start the program.
pause
