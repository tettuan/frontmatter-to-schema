#!/bin/sh
# Generate traceability index files using frontmatter-to-schema CLI
# This script processes Markdown files in docs/ directory and extracts
# traceability information from their frontmatter to create index files

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure index directory exists
mkdir -p "$SCRIPT_DIR/index"

# Process each traceability level using the CLI
for level in req spec design impl test; do
    echo "Processing ${level} level..."

    # Run the frontmatter-to-schema CLI
    # Arguments: <schema> <output> <pattern>
    deno run --allow-all cli.ts \
        "${SCRIPT_DIR}/index_${level}_schema.json" \
        "${SCRIPT_DIR}/index/${level}_index.json" \
        "${SCRIPT_DIR}/docs/**/*.md" \
        --verbose

    if [ $? -eq 0 ]; then
        echo "Generated index for ${level} level: index/${level}_index.json"
    else
        echo "Error processing ${level} level"
    fi
done

echo "All index files processed."