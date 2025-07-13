#!/bin/bash

# VS Code拡張機能のプラットフォーム固有パッケージを作成するスクリプト

set -e

echo "Building platform-specific packages for VS Code extension..."

# 各プラットフォーム用のnode-ptyをビルドしてパッケージを作成
platforms=(
    "win32-x64"
    "win32-arm64" 
    "linux-x64"
    "linux-arm64"
    "linux-armhf"
    "darwin-x64"
    "darwin-arm64"
    "alpine-x64"
    "alpine-arm64"
)

for platform in "${platforms[@]}"; do
    echo ""
    echo "📦 Building package for $platform..."
    
    # Clean previous build artifacts
    echo "  → Cleaning previous build artifacts..."
    rm -rf node_modules/node-pty/build
    
    # Note: Platform-specific rebuilding should happen on the target platform
    echo "  → Note: For accurate builds, run this on the target platform or use CI"
    
    # プラットフォーム固有のVSIXパッケージを作成
    echo "  → Creating VSIX package..."
    npm run vsce:package:$platform
    
    echo "  ✅ Package created: vscode-sidebar-terminal-$platform-*.vsix"
done

echo ""
echo "🎉 All platform-specific packages created successfully!"
echo ""
echo "📁 Generated packages:"
ls -la *.vsix | grep -E "(win32|linux|darwin|alpine)"