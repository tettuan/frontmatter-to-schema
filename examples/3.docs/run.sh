#!/bin/bash

# Spec-Trace Index Generator
# Generate traceability index files using frontmatter-to-schema CLI
# This script processes Markdown files in docs/ directory and extracts
# traceability information from their frontmatter to create index files

set -e

echo "=== Spec-Trace Index Generation ==="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CLI="$PROJECT_ROOT/cli.ts"

# Change to project root for execution
cd "$PROJECT_ROOT"

# Configuration
SPEC_TRACE_DIR="examples/3.docs"
DOCS_DIR="${SPEC_TRACE_DIR}/docs"

# Ensure index directory exists
mkdir -p "$SPEC_TRACE_DIR/index"

echo "Processing spec-trace levels..."
echo "Source: $DOCS_DIR"
echo "Target: $SPEC_TRACE_DIR/index/"
echo

# Process each traceability level using the CLI
OVERALL_SUCCESS=true
for level in req spec design impl test; do
    echo "Processing ${level} level..."

    # Run the frontmatter-to-schema CLI
    # Correct order: <schema> <output> <input...> [--verbose]
    "$CLI" \
        "${SPEC_TRACE_DIR}/index_${level}_schema.json" \
        "${SPEC_TRACE_DIR}/index/${level}_index.json" \
        "$DOCS_DIR" \
        --verbose

    if [ $? -eq 0 ]; then
        echo "✅ Generated index for ${level} level: index/${level}_index.json"
    else
        echo "❌ Error processing ${level} level"
        OVERALL_SUCCESS=false
    fi
    echo
done

echo "=== Summary ==="
if [ "$OVERALL_SUCCESS" = true ]; then
    echo "✅ All spec-trace index files processed successfully"
    echo "📁 Index files created in: $SPEC_TRACE_DIR/index/"
    exit 0
else
    echo "❌ Some index files failed to process"
    exit 2
fi