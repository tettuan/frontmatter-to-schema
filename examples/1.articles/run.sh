#!/bin/bash

# Article Index Generator
# Processes markdown files in docs/ directory to create an article index

echo "=== Article Index Generation ==="

# Configuration
SCHEMA_FILE="./examples/1.articles/articles_schema.json"
OUTPUT_FILE="./examples/1.articles/articles-index-output.yml"
DOCS_DIR="./examples/1.articles/docs"

# Create tmp directory if it doesn't exist
mkdir -p tmp

echo "Processing article files..."
echo "Schema: $SCHEMA_FILE"
echo "Input: $DOCS_DIR"
echo "Output: $OUTPUT_FILE"
echo

# Execute frontmatter-to-schema command
./frontmatter-to-schema \
  "$SCHEMA_FILE" \
  "$OUTPUT_FILE" \
  "$DOCS_DIR/**/*.md" \
  -o=yaml \
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
        # Extract counts if possible
        if command -v grep >/dev/null 2>&1; then
            TOTAL_COUNT=$(grep -E "^total_articles:" "$OUTPUT_FILE" | head -1 | sed 's/total_articles: //' 2>/dev/null || echo "N/A")
            PUBLISHED_COUNT=$(grep -E "^published_count:" "$OUTPUT_FILE" | head -1 | sed 's/published_count: //' 2>/dev/null || echo "N/A")
            DRAFT_COUNT=$(grep -E "^draft_count:" "$OUTPUT_FILE" | head -1 | sed 's/draft_count: //' 2>/dev/null || echo "N/A")
            echo "Total articles: $TOTAL_COUNT"
            echo "Published: $PUBLISHED_COUNT"
            echo "Drafts: $DRAFT_COUNT"
        fi
    fi
    exit 0
else
    echo "❌ Article index generation failed (exit: $EXIT_STATUS)"
    exit 2
fi
