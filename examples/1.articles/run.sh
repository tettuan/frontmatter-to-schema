#!/bin/bash

# Article Index Generator
# Processes markdown files in docs/ directory to create an article index

set -e

echo "=== Article Index Generation ==="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CLI="$PROJECT_ROOT/cli.ts"

# Change to project root for execution
cd "$PROJECT_ROOT"

# Configuration
SCHEMA_FILE="examples/1.articles/articles_schema.json"
OUTPUT_FILE="examples/1.articles/articles-index-output.yml"
DOCS_DIR="examples/1.articles/docs"

# Create tmp directory if it doesn't exist
mkdir -p tmp

echo "Processing article files..."
echo "Schema: $SCHEMA_FILE"
echo "Input: $DOCS_DIR"
echo "Output: $OUTPUT_FILE"
echo

# Execute frontmatter-to-schema command
deno run --allow-all "$CLI" \
  "$SCHEMA_FILE" \
  "$OUTPUT_FILE" \
  "$DOCS_DIR" \
  --verbose

# Capture the exit status
EXIT_STATUS=$?

echo
if [ $EXIT_STATUS -eq 0 ]; then
    echo "✅ Article index generation completed successfully"
    echo "📄 Output written to: $OUTPUT_FILE"

    # Show summary of generated index
    if [ -f "$OUTPUT_FILE" ]; then
        echo
        echo "=== Generated Index Summary ==="
        echo "Index file generated successfully."
    fi
    exit 0
else
    echo "❌ Article index generation failed (exit: $EXIT_STATUS)"
    exit 2
fi
