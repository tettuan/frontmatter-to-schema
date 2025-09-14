#!/bin/bash
# Two-stage processing for Climpt registry generation
# Following requirements from docs/requirements.ja.md

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_DIR="$BASE_DIR/.agent/test-climpt"

PROMPTS_DIR="$TEST_DIR/prompts"
COMMAND_SCHEMA="$TEST_DIR/registry_command_schema.json"
COMMAND_TEMPLATE="$TEST_DIR/registry_command_template.json"
REGISTRY_SCHEMA="$TEST_DIR/registry_schema.json"
REGISTRY_TEMPLATE="$TEST_DIR/registry_template.json"
OUTPUT_FILE="$TEST_DIR/registed-commands.json"

echo "=== Climpt Registry Two-Stage Processing ==="
echo "Base directory: $BASE_DIR"
echo ""

# Stage 1: Process each markdown file with command schema/template
echo "=== Stage 1: Processing individual commands ==="
echo "Input: $PROMPTS_DIR"
echo "Schema: $COMMAND_SCHEMA"
echo "Template: $COMMAND_TEMPLATE"
echo ""

# Create temporary file for stage 1 output
STAGE1_OUTPUT=$(mktemp -t stage1_output.XXXXXX.json)

# Process all markdown files with command schema/template
"$BASE_DIR/frontmatter-to-schema" "$PROMPTS_DIR" \
  --schema="$COMMAND_SCHEMA" \
  --template="$COMMAND_TEMPLATE" \
  --destination="$STAGE1_OUTPUT" \
  --verbose

echo ""
echo "Stage 1 output saved to: $STAGE1_OUTPUT"

# Stage 2: Transform the output into proper registry format
echo ""
echo "=== Stage 2: Creating registry structure ==="

# Use Node.js to process the output and create the final registry
node -e "
const fs = require('fs');

// Read stage 1 output
const stage1Data = JSON.parse(fs.readFileSync('$STAGE1_OUTPUT', 'utf-8'));

// Extract commands from the incorrect structure
let commands = [];

if (stage1Data.tools && stage1Data.tools.commands) {
  // Current implementation wraps each command incorrectly
  // We need to extract the actual command data
  for (const item of stage1Data.tools.commands) {
    if (item.ok && item.data) {
      // The data contains partial command info
      // We need to reconstruct from the original frontmatter
      // For now, use what we have
      commands.push(item.data);
    } else if (item.c1) {
      // Properly formatted command
      commands.push(item);
    }
  }
} else if (Array.isArray(stage1Data)) {
  // If it's already an array of commands
  commands = stage1Data;
}

// Extract unique c1 values for availableConfigs
const uniqueC1 = [...new Set(commands.map(cmd => cmd.c1).filter(Boolean))];

// Create the final registry structure
const registry = {
  version: '1.0.0',
  description: 'Climpt Command Registry',
  tools: {
    availableConfigs: uniqueC1.sort(),
    commands: commands
  }
};

// Write the final output
fs.writeFileSync('$OUTPUT_FILE', JSON.stringify(registry, null, 2));

console.log('Registry created successfully!');
console.log('Available configs:', uniqueC1.sort().join(', '));
console.log('Total commands:', commands.length);
"

echo ""
echo "=== Processing Complete ==="
echo "Output saved to: $OUTPUT_FILE"

# Clean up temporary file
rm -f "$STAGE1_OUTPUT"