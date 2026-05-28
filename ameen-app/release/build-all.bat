@echo off
echo ===============================================
echo  Ameen v1.0.0 — Full Release Build
echo ===============================================
echo.

echo [1/4] Building shared-crypto tests...
cd /d "%~dp0..\shared-crypto"
call npm test
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: shared-crypto tests failed
  exit /b 1
)
echo.

echo [2/4] Building Android release...
cd /d "%~dp0..\android"
call build-release.bat
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Android build failed
  exit /b 1
)
echo.

echo [3/4] Building Windows release...
cd /d "%~dp0..\windows"
call build-release.bat
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Windows build failed
  exit /b 1
)
echo.

echo [4/4] Building browser extensions...
cd /d "%~dp0..\extension"
call build-release.bat
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Extension build failed
  exit /b 1
)
echo.

echo ===============================================
echo  Generating SHA256 checksums...
cd /d "%~dp0"
certutil -hashfile *.apk SHA256 > SHA256SUMS.txt 2>nul
certutil -hashfile *.aab SHA256 >> SHA256SUMS.txt 2>nul
certutil -hashfile ameen-windows-v1.0.0\Ameen.Windows.exe SHA256 >> SHA256SUMS.txt 2>nul
for %%f in (*.zip) do certutil -hashfile "%%f" SHA256 >> SHA256SUMS.txt 2>nul

echo.
echo ===============================================
echo  Release build complete!
echo  Output: %~dp0
echo ===============================================
dir
