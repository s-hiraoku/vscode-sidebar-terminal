#!/bin/bash

# Local Build Test Script
# Tests the extension build on the current platform

set -e

echo "🧪 Testing local extension build..."

# Show current platform
echo "🔍 Current platform: $(uname -s)-$(uname -m)"
echo "🔍 Node.js platform: $OSTYPE"
echo "🔍 Process platform: node -p \"process.platform + '-' + process.arch\""

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Check node-pty installation
echo "🔧 Checking node-pty installation..."
if [ -f "node_modules/node-pty/build/Release/pty.node" ]; then
    echo "✅ node-pty binary found"
    file node_modules/node-pty/build/Release/pty.node
else
    echo "❌ node-pty binary not found, rebuilding..."
    npm rebuild node-pty
    if [ -f "node_modules/node-pty/build/Release/pty.node" ]; then
        echo "✅ node-pty rebuilt successfully"
        file node_modules/node-pty/build/Release/pty.node
    else
        echo "❌ Failed to build node-pty"
        exit 1
    fi
fi

# Build extension
echo "🔨 Building extension..."
npm run compile

# Package extension for current platform
echo "📦 Creating VSIX package..."
npx vsce package

# List created packages
echo "📁 Created packages:"
ls -la *.vsix

echo "✅ Local build test completed successfully!"