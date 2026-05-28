#!/bin/bash
set -e
echo "🔨 Building Ameen Android v1.0.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RELEASE_DIR="../release"
mkdir -p "$RELEASE_DIR"

if [ ! -f "keystore.properties" ]; then
  echo "⚠️  keystore.properties not found — producing unsigned build"
fi

echo "📦 Building APK..."
./gradlew assembleRelease
APK_FILE=$(find app/build/outputs/apk/release -name "*.apk" 2>/dev/null | head -1)
if [ -n "$APK_FILE" ]; then
  cp "$APK_FILE" "$RELEASE_DIR/ameen-android-v1.0.0.apk"
  echo "✅ APK: $RELEASE_DIR/ameen-android-v1.0.0.apk ($(wc -c < "$RELEASE_DIR/ameen-android-v1.0.0.apk") bytes)"
fi

echo "📦 Building AAB..."
./gradlew bundleRelease
AAB_FILE="app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_FILE" ]; then
  cp "$AAB_FILE" "$RELEASE_DIR/ameen-android-v1.0.0.aab"
  echo "✅ AAB: $RELEASE_DIR/ameen-android-v1.0.0.aab ($(wc -c < "$RELEASE_DIR/ameen-android-v1.0.0.aab") bytes)"
fi

echo "✨ Android build complete"
