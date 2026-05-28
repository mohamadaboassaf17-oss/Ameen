@echo off
echo ========================================
echo  Building Ameen Windows v1.0.0
echo ========================================
cd /d "%~dp0"

if not exist "..\release" mkdir "..\release"

echo Publishing Windows release...
dotnet publish Ameen.Windows.csproj -c Release -f net8.0-windows10.0.19041.0 /p:WindowsPackageType=None /p:AppxPackage=false /p:SelfContained=true /p:RuntimeIdentifier=win-x64 -o "..\release\ameen-windows-v1.0.0"

if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Build failed
  exit /b 1
)

echo.
echo ========================================
echo  Build complete
echo  Output: ..\release\ameen-windows-v1.0.0\
echo.
echo  Note: This produces a portable folder build.
echo  For MSIX packaging (Store/sideloading):
echo    Open Ameen.Windows.sln in Visual Studio 2022
echo    Right-click project ^> Publish ^> Create App Package
echo ========================================
