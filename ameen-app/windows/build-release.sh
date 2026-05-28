#!/bin/bash
set -e
echo "========================================"
echo " Building Ameen Windows v1.0.0"
echo "========================================"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RELEASE_DIR="../release"
mkdir -p "$RELEASE_DIR"

echo "Publishing Windows release..."
dotnet publish Ameen.Windows.csproj -c Release -f net8.0-windows10.0.19041.0 --self-contained false -p:WindowsPackageType=None -p:AppxPackage=false -o "$RELEASE_DIR/ameen-windows-v1.0.0"

echo ""
echo "========================================"
echo " Build complete"
echo " Output: $RELEASE_DIR/ameen-windows-v1.0.0/"
echo "========================================"
