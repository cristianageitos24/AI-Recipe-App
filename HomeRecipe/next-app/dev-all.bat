@echo off
REM Start dev server and video worker in separate windows (no concurrently needed).
REM Double-click this file or run from cmd: dev-all.bat

set "ROOT=%~dp0"
cd /d "%ROOT%"

start "Next.js Dev Server" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
start "Video Worker" cmd /k "npm run worker:video"

echo.
echo Started in separate windows:
echo   - Dev server: http://localhost:3000
echo   - Video worker: running in its own window
echo.
echo Close this window anytime. To stop dev/worker, close their windows or Ctrl+C there.
pause
