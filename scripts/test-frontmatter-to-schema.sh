#!/bin/bash

# Source path configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../config/paths.sh"

# Execute frontmatter-to-schema command with mock analyzer (silent mode)
FRONTMATTER_TO_SCHEMA_TEST_MODE=true ./frontmatter-to-schema "$TEST_PROMPTS_DIR" \
  --schema="$TEST_REGISTRY_SCHEMA" \
  --template="$TEST_REGISTRY_TEMPLATE" \
  --destination="$TEST_OUTPUT_FILE" \
  >/dev/null 2>&1

# Capture the exit status
EXIT_STATUS=$?

# Return exit status 0 or 2
if [ $EXIT_STATUS -eq 0 ]; then
  exit 0
else
  exit 2
fi