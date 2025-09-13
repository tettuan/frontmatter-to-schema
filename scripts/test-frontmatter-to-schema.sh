#!/bin/bash

# Source path configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../config/paths.sh"

# Execute frontmatter-to-schema command with new CLI interface
# New format: frontmatter-to-schema <schema> <output> <pattern>
# Use recursive pattern to find all .md files in subdirectories
FRONTMATTER_TO_SCHEMA_TEST_MODE=true ./frontmatter-to-schema \
  "$TEST_REGISTRY_SCHEMA" \
  "$TEST_OUTPUT_FILE" \
  "$TEST_PROMPTS_DIR/**/*.md" \
  >/dev/null 2>&1

# Capture the exit status
EXIT_STATUS=$?

# Return exit status 0 or 2
if [ $EXIT_STATUS -eq 0 ]; then
  exit 0
else
  exit 2
fi