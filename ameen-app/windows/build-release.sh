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
dotnet publish Ameen.Windows.csproj -c Release -f net8.0-windows10.0.19041.0 /p:WindowsPackageType=None /p:AppxPackage=false /p:SelfContained=true /p:RuntimeIdentifier=win-x64 -o "$RELEASE_DIR/ameen-windows-v1.0.0"

echo ""
echo "========================================"
echo " Build complete"
echo " Output: $RELEASE_DIR/ameen-windows-v1.0.0/"
echo ""
echo " Note: This produces a portable folder build."
echo " For MSIX packaging (Store/sideloading):"
echo "   Open Ameen.Windows.sln in Visual Studio 2022"
echo "   Right-click project > Publish > Create App Package"
echo "========================================"
