#!/bin/sh
# 全レベル処理

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Change to script directory for correct relative paths
cd "$SCRIPT_DIR"

for level in req spec design impl test; do
    deno run --allow-all "$PROJECT_ROOT/cli.ts" \
        "index_${level}_schema.json" \
        "index/${level}_index.json" \
        "docs/**/*.md" \
        --verbose
done