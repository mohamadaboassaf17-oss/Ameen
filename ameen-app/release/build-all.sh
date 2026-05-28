#!/bin/bash
set -e
echo "==============================================="
echo " Ameen v1.0.0 — Full Release Build"
echo "==============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/4] Testing shared-crypto..."
cd "$SCRIPT_DIR/../shared-crypto"
npm test
echo ""

echo "[2/4] Building Android release..."
cd "$SCRIPT_DIR/../android"
bash build-release.sh
echo ""

echo "[3/4] Building Windows release..."
cd "$SCRIPT_DIR/../windows"
bash build-release.sh
echo ""

echo "[4/4] Building browser extensions..."
cd "$SCRIPT_DIR/../extension"
bash build-release.sh
echo ""

echo "==============================================="
echo " Generating SHA256 checksums..."
cd "$SCRIPT_DIR"
shasum -a 256 *.apk *.aab *.zip > SHA256SUMS.txt 2>/dev/null
shasum -a 256 ameen-windows-v1.0.0/Ameen.Windows.exe >> SHA256SUMS.txt 2>/dev/null

echo ""
echo "==============================================="
echo " Release build complete!"
echo " Output: $SCRIPT_DIR"
echo "==============================================="
ls -lh
