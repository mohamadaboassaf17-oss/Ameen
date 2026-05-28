@echo off
echo ========================================
echo  Building Ameen Windows v1.0.0
echo ========================================
cd /d "%~dp0"

set DOTNET_EXE=%LOCALAPPDATA%\Microsoft\dotnet\dotnet.exe

REM Install local .NET 8 SDK + MAUI if missing
if not exist "%DOTNET_EXE%" (
  echo Installing .NET SDK 8.0.400 locally...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://dot.net/v1/dotnet-install.ps1', '%TEMP%\dotnet-install.ps1'); & '%TEMP%\dotnet-install.ps1' -Channel 8.0 -Version 8.0.400 -InstallDir '%LOCALAPPDATA%\Microsoft\dotnet' -Architecture x64"
  if !ERRORLEVEL! NEQ 0 (
    echo Failed to install .NET SDK
    pause
    exit /b 1
  )
)

REM Check and install MAUI workload
"%DOTNET_EXE%" workload list 2>nul | findstr /c:"maui" >nul
if !ERRORLEVEL! NEQ 0 (
  echo Installing MAUI workload...
  "%DOTNET_EXE%" workload install maui --skip-sign-check
  if !ERRORLEVEL! NEQ 0 (
    echo Failed to install MAUI workload
    pause
    exit /b 1
  )
)

REM Create release directory
if not exist "..\release" mkdir "..\release"

echo Publishing Windows release...
"%DOTNET_EXE%" publish Ameen.Windows.csproj -c Release -f net8.0-windows10.0.19041.0 --self-contained false -p:WindowsPackageType=None -p:AppxPackage=false -o "..\release\ameen-windows-v1.0.0"

if !ERRORLEVEL! NEQ 0 (
  echo.
  echo Build failed!
  pause
  exit /b 1
)

echo.
echo ========================================
echo  Build complete
echo  Output: ..\release\ameen-windows-v1.0.0\
echo ========================================
exit /b 0
