@echo off
echo Building Ameen Browser Extensions v1.0.0
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

set VERSION=1.0.0
call npm run package

echo.
echo Built extensions:
dir release\*.zip 2>nul
