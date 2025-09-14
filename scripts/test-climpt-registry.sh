#!/bin/bash

# Test configuration
TEST_REGISTRY_SCHEMA="./examples/climpt-registry/schema.json"
TEST_REGISTRY_TEMPLATE="./examples/climpt-registry/template.json"
TEST_PROMPTS_DIR="./.agent/climpt/prompts"
TEST_OUTPUT_FILE="./tmp/test-output.json"

# Execute frontmatter-to-schema command with specified parameters
frontmatter-to-schema "$TEST_PROMPTS_DIR" \
  --schema="$TEST_REGISTRY_SCHEMA" \
  --template="$TEST_REGISTRY_TEMPLATE" \
  --destination="$TEST_OUTPUT_FILE" \
  --verbose

# Capture the exit status
EXIT_STATUS=$?

# Return exit status 0 or 2
if [ $EXIT_STATUS -eq 0 ] || [ $EXIT_STATUS -eq 2 ]; then
  exit $EXIT_STATUS
else
  # If exit status is neither 0 nor 2, return 2
  exit 2
fi