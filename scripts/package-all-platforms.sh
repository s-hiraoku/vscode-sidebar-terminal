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
    
    # node-ptyを該当プラットフォーム用にリビルド
    echo "  → Rebuilding node-pty for $platform..."
    npm rebuild --target-platform=${platform%%-*} --target-arch=${platform##*-}
    
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