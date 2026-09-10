@echo off
setlocal EnableExtensions
title Dropzone Builder
echo.
echo ========================================
echo          DROPZONE BUILD TOOL
echo ========================================
echo.

set "ROOT=D:\Github\Game\_dropzone"
if not exist "%ROOT%\client\dropzone-a\package.json" set "ROOT=D:\Github\Game_dropzone"
set "CLIENT=%ROOT%\client\dropzone-a"

if not exist "%CLIENT%\package.json" (
  echo [ERROR] 找不到開發專案：%CLIENT%
  echo 請確認資料夾位置，或修改此工具中的 ROOT 路徑。
  goto fail
)

cd /d "%CLIENT%"
echo [1/3] 開發端：%CLIENT%

if not exist "node_modules\vite\bin\vite.js" (
  where pnpm >nul 2>nul
  if not errorlevel 1 (
    echo [2/3] 安裝依賴：pnpm install
    call pnpm install
  ) else (
    where npm >nul 2>nul
    if errorlevel 1 (
      echo [ERROR] 找不到 Node.js / npm / pnpm。
      echo 請先安裝 Node.js LTS：https://nodejs.org/
      goto fail
    )
    echo [2/3] 安裝依賴：npm install
    call npm install
  )
  if errorlevel 1 goto fail
) else (
  echo [2/3] 已找到本機依賴，跳過安裝。
)

echo [3/3] 建立發布檔案：dist
node "node_modules\vite\bin\vite.js" build
if errorlevel 1 goto fail

echo.
echo ========================================
echo 完成！dist 已更新：
echo %CLIENT%\dist
echo ========================================
echo.
echo 請自行將 dist 內容複製到測試遊玩端。
pause
exit /b 0

:fail
echo.
echo [ERROR] 建置或同步失敗，發布端沒有被更新完成。
pause
exit /b 1
