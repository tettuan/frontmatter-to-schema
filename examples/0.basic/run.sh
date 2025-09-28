#!/bin/bash

# Basic example execution script
# Run from project root: bash examples/0.basic/run.sh

set -e

echo "Running basic frontmatter-to-schema example..."
echo "=========================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "Script directory: ${SCRIPT_DIR}"
echo "Project root: ${PROJECT_ROOT}"

# Change to project root for execution
cd "${PROJECT_ROOT}"

# Execute the CLI with correct paths relative to project root
echo "Executing command:"
echo "./cli.ts examples/0.basic/registry_schema.json \"examples/0.basic/*.md\" examples/0.basic/output.json --verbose"
echo ""

./cli.ts \
  examples/0.basic/registry_schema.json \
  "examples/0.basic/*.md" \
  examples/0.basic/output.json \
  --verbose

echo ""
echo "Execution completed. Check examples/0.basic/output.json for results."
echo ""
echo "Expected output structure:"
echo "- version: 1.0.0"
echo "- description: Basic command registry example"
echo "- tools.availableConfigs: [\"git\", \"spec\"] (derived from c1 fields)"
echo "- tools.commands: Array of 2 command objects with {@items} expansion"