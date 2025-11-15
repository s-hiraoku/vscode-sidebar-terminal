#!/bin/bash

# Script to replace console.log/warn/error with logger imports and calls
# This script adds eslint-disable-next-line comments to existing console usage

set -e

# Files to process (excluding test files, logger files, and webview files for now)
FILES=$(find src/core src/extension src/services src/messaging src/handlers -type f \( -name "*.ts" -o -name "*.js" \) ! -name "*.test.ts" ! -name "*.spec.ts" ! -name "*logger*" ! -name "*Logger*" -exec grep -l "console\." {} \;)

echo "Processing files with console usage..."
echo "$FILES"

for file in $FILES; do
  echo "Processing: $file"

  # Check if logger is already imported
  if ! grep -q "from.*logger" "$file"; then
    # Determine relative path to logger
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    rel_path=""
    for ((i=1; i<depth; i++)); do
      rel_path="../$rel_path"
    done
    rel_path="${rel_path}utils/logger"

    # Find the last import statement
    last_import=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)

    if [ -n "$last_import" ]; then
      # Add logger import after last import
      sed -i "${last_import}a import { error as logError, warn as logWarn, info as logInfo, debug as logDebug } from '${rel_path}';" "$file"
      echo "  Added logger import"
    fi
  fi

  # Replace console.error with logError
  sed -i 's/console\.error(/logError(/g' "$file"

  # Replace console.warn with logWarn
  sed -i 's/console\.warn(/logWarn(/g' "$file"

  # Replace console.log with logInfo (default to info level)
  sed -i 's/console\.log(/logInfo(/g' "$file"

  echo "  Replaced console calls"
done

echo "Done!"
