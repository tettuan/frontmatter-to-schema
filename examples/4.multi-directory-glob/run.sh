#!/bin/bash
set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CLI="$PROJECT_ROOT/.deno/bin/frontmatter-to-schema"

echo "=== Multi-Directory Glob Pattern Test ==="
echo ""

echo "Directory structure:"
find docs -name "*.md" | sort
echo ""

echo "Test 1: Glob pattern (CURRENTLY FAILS - Issue #1285)"
echo "Command: frontmatter-to-schema $SCRIPT_DIR/schema.json $SCRIPT_DIR/output-glob.json $SCRIPT_DIR/docs/**/*.md --verbose"
if "$CLI" "$SCRIPT_DIR/schema.json" "$SCRIPT_DIR/output-glob.json" "$SCRIPT_DIR/docs/"**/*.md --verbose 2>&1; then
    echo "✅ Glob pattern test PASSED"
    cat "$SCRIPT_DIR/output-glob.json"
else
    echo "❌ Glob pattern test FAILED (expected - this is the bug)"
fi
echo ""

echo "Test 2: Directory path (WORKAROUND - should work)"
echo "Command: frontmatter-to-schema $SCRIPT_DIR/schema.json $SCRIPT_DIR/output-dir.json $SCRIPT_DIR/docs/ --verbose"
if "$CLI" "$SCRIPT_DIR/schema.json" "$SCRIPT_DIR/output-dir.json" "$SCRIPT_DIR/docs/" --verbose; then
    echo "✅ Directory path test PASSED"
    cat "$SCRIPT_DIR/output-dir.json"
else
    echo "❌ Directory path test FAILED"
fi
echo ""
