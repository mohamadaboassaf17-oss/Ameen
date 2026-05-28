@echo off
echo Building Ameen Android v1.0.0
cd /d "%~dp0"

if not exist "..\release" mkdir "..\release"

if not exist "keystore.properties" (
  echo WARNING: keystore.properties not found - producing unsigned build
)

echo Building APK...
call gradlew.bat assembleRelease
for /r "app\build\outputs\apk\release" %%f in (*.apk) do (
  copy /y "%%f" "..\release\ameen-android-v1.0.0.apk"
  echo APK: ..\release\ameen-android-v1.0.0.apk
)

echo Building AAB...
call gradlew.bat bundleRelease
if exist "app\build\outputs\bundle\release\app-release.aab" (
  copy /y "app\build\outputs\bundle\release\app-release.aab" "..\release\ameen-android-v1.0.0.aab"
  echo AAB: ..\release\ameen-android-v1.0.0.aab
)

echo Android build complete
