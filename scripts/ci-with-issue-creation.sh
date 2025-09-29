#!/bin/bash

# CI execution script with issue creation capability
# This script runs the CI pipeline and creates issues if failures occur

set -e

echo "Running CI pipeline..."

# Run the main CI task
deno task ci

# If we get here, CI passed successfully
echo "CI completed successfully"
exit 0