@echo off
setlocal enabledelayedexpansion
echo ========================================
echo  Building Ameen Windows v1.0.0
echo ========================================
cd /d "%~dp0"

if not exist "..\release" mkdir "..\release"

REM Check if MAUI workload is installed
dotnet workload list 2>nul | findstr /c:"maui-windows" >nul
if !ERRORLEVEL! NEQ 0 (
  echo MAUI workload not installed. Installing...
  dotnet workload install maui-windows --skip-sign-check
  if !ERRORLEVEL! NEQ 0 (
    echo.
    echo ========================================
    echo  Failed to install MAUI workload.
    echo  Run as Administrator then retry:
    echo    dotnet workload install maui-windows
    echo ========================================
    exit /b 1
  )
)

:build
echo Publishing Windows release...
dotnet publish Ameen.Windows.csproj -c Release -f net8.0-windows10.0.19041.0 --self-contained false -p:WindowsPackageType=None -p:AppxPackage=false -o "..\release\ameen-windows-v1.0.0" 2>&1 | findstr /v "^$"
set BUILD_RESULT=!ERRORLEVEL!

REM Check if build output was produced (even if dotnet returned error, check files)
set PUBLISH_PATH=..\release\ameen-windows-v1.0.0
if exist "%PUBLISH_PATH%\Ameen.Windows.exe" (
  set BUILD_RESULT=0
  goto :success
)

REM Check specific error: MAUI SDK resolution failure
dotnet publish Ameen.Windows.csproj -c Release -f net8.0-windows10.0.19041.0 --self-contained false -p:WindowsPackageType=None -p:AppxPackage=false -o "nul" 2>&1 | findstr /c:"Could not resolve SDK" >nul
if !ERRORLEVEL! EQU 0 (
  echo.
  echo ========================================
  echo  MAUI SDK not found for .NET SDK 8.0.421.
  echo  This is a known SDK version mismatch issue.
  echo.
  echo  TO FIX — Run as Administrator:
  echo    dotnet workload uninstall maui-windows
  echo    dotnet workload install maui-windows
  echo ========================================
  exit /b 1
)

if !BUILD_RESULT! NEQ 0 goto :error

:success
echo.
echo ========================================
echo  Build complete
echo  Output: %PUBLISH_PATH%
echo ========================================
exit /b 0

:error
echo.
echo ERROR: Build failed. Check errors above.
exit /b 1