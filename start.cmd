@echo off
setlocal
cd /d "%~dp0"
set "DROPZONE_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "DROPZONE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "node_modules\vite\bin\vite.js" (
  echo Please install dependencies first: pnpm install
  pause
  exit /b 1
)
"%DROPZONE_NODE%" node_modules\vite\bin\vite.js --host 127.0.0.1 --open
pause
