#!/bin/bash
set -e
echo "🔨 Building Ameen Browser Extensions v1.0.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

VERSION=1.0.0 npm run package

echo ""
echo "Built extensions:"
ls -lh release/*.zip 2>/dev/null || echo "No zip files found"
