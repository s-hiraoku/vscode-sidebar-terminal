#!/bin/bash

# Test Infrastructure Metrics
# Analyzes the current state of test infrastructure

echo "======================================"
echo "Test Infrastructure Metrics Report"
echo "======================================"
echo ""

echo "📊 Test File Statistics:"
echo "------------------------"
TOTAL_TEST_FILES=$(find src/test/unit -name "*.test.ts" | wc -l | tr -d ' ')
echo "Total test files: $TOTAL_TEST_FILES"

MIGRATED_FILES=$(grep -r "extends BaseTest\|extends ConfigurationTest\|extends AsyncTest\|extends WebViewTest\|extends TerminalTest" src/test/unit --include="*.test.ts" | wc -l | tr -d ' ')
echo "Migrated to base classes: $MIGRATED_FILES"

PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($MIGRATED_FILES / $TOTAL_TEST_FILES) * 100}")
echo "Migration percentage: ${PERCENTAGE}%"
echo ""

echo "📝 Test Count Statistics:"
echo "------------------------"
DESCRIBE_COUNT=$(grep -r "describe(" src/test/unit --include="*.test.ts" | wc -l | tr -d ' ')
echo "Test suites (describe): $DESCRIBE_COUNT"

IT_COUNT=$(grep -r "it(" src/test/unit --include="*.test.ts" | wc -l | tr -d ' ')
echo "Individual tests (it): $IT_COUNT"

AVG_TESTS=$(awk "BEGIN {printf \"%.1f\", $IT_COUNT / $TOTAL_TEST_FILES}")
echo "Average tests per file: $AVG_TESTS"
echo ""

echo "🏗️  Base Class Usage:"
echo "--------------------"
BASE_TEST=$(grep -r "extends BaseTest" src/test/unit --include="*.test.ts" | wc -l | tr -d ' ')
echo "BaseTest: $BASE_TEST files"

CONFIG_TEST=$(grep -r "extends ConfigurationTest" src/test/unit --include="*.test.ts" | wc -l | tr -d ' ')
echo "ConfigurationTest: $CONFIG_TEST files"

ASYNC_TEST=$(grep -r "extends AsyncTest" src/test/unit --include="*.test.ts" | wc -l | tr -d ' ')
echo "AsyncTest: $ASYNC_TEST files"

WEBVIEW_TEST=$(grep -r "extends WebViewTest" src/test/unit --include="*.test.ts" | wc -l | tr -d ' ')
echo "WebViewTest: $WEBVIEW_TEST files"

TERMINAL_TEST=$(grep -r "extends TerminalTest" src/test/unit --include="*.test.ts" | wc -l | tr -d ' ')
echo "TerminalTest: $TERMINAL_TEST files"
echo ""

echo "📦 Code Size Metrics:"
echo "--------------------"
TOTAL_TEST_LINES=$(cat src/test/unit/**/*.test.ts 2>/dev/null | wc -l | tr -d ' ')
if [ "$TOTAL_TEST_LINES" = "0" ]; then
  TOTAL_TEST_LINES=$(find src/test/unit -name "*.test.ts" -exec cat {} \; | wc -l | tr -d ' ')
fi
echo "Total test code lines: $TOTAL_TEST_LINES"

UTILS_LINES=$(cat src/test/utils/*.ts 2>/dev/null | wc -l | tr -d ' ')
echo "Test utilities lines: $UTILS_LINES"

DOC_LINES=$(cat src/test/utils/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Documentation lines: $DOC_LINES"
echo ""

echo "📈 Infrastructure Files:"
echo "----------------------"
echo "Base test classes:"
ls -1 src/test/utils/*.ts | grep -v index.ts | grep -v test-helpers.ts | wc -l | tr -d ' ' | xargs echo "  "
echo ""
echo "Documentation files:"
ls -1 src/test/utils/*.md 2>/dev/null | wc -l | tr -d ' ' | xargs echo "  "
echo ""

echo "🎯 Migration Opportunities:"
echo "--------------------------"
UNMIGRATED=$((TOTAL_TEST_FILES - MIGRATED_FILES))
echo "Files ready for migration: $UNMIGRATED"

echo ""
echo "======================================"
echo "Report generated: $(date)"
echo "======================================"
