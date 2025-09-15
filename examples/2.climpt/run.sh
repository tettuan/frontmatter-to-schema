#!/bin/bash

# Climpt Registry Example Runner
# Processes .agent/climpt/prompts with climpt registry schema

echo "=== Climpt Registry Processing ==="

# Test configuration
REGISTRY_SCHEMA="./examples/2.climpt/registry_schema.json"
OUTPUT_FILE="./examples/2.climpt/climpt-registry-output.json"
PROMPTS_DIR="./examples/2.climpt/prompts"

# Create tmp directory if it doesn't exist
mkdir -p tmp

echo "Processing climpt prompts..."
echo "Schema: $REGISTRY_SCHEMA"
echo "Input: $PROMPTS_DIR"
echo "Output: $OUTPUT_FILE"
echo

# Execute frontmatter-to-schema command with new CLI interface
FRONTMATTER_TO_SCHEMA_TEST_MODE=true ./frontmatter-to-schema \
  "$REGISTRY_SCHEMA" \
  "$OUTPUT_FILE" \
  "$PROMPTS_DIR/**/*.md" \
  --verbose

# Capture the exit status
EXIT_STATUS=$?

echo
if [ $EXIT_STATUS -eq 0 ]; then
    echo "✅ Climpt registry processing completed successfully"
    echo "📄 Output written to: $OUTPUT_FILE"

    # Show summary of generated registry
    if [ -f "$OUTPUT_FILE" ]; then
        echo
        echo "=== Generated Registry Summary ==="
        # Extract number of commands if possible
        if command -v jq >/dev/null 2>&1; then
            COMMAND_COUNT=$(jq '.commands | length' "$OUTPUT_FILE" 2>/dev/null || echo "N/A")
            echo "Commands found: $COMMAND_COUNT"
        fi
    fi
    exit 0
else
    echo "❌ Climpt registry processing failed (exit: $EXIT_STATUS)"
    exit 2
fi
