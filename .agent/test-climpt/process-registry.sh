#!/bin/bash
# Two-stage processing script for registry generation

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"
OUTPUT_DIR="$SCRIPT_DIR/output"
FINAL_OUTPUT="$SCRIPT_DIR/registed-commands.json"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "=== Stage 1: Process individual commands ==="
echo "Processing markdown files from: $PROMPTS_DIR"

# Process each markdown file with command schema/template
./frontmatter-to-schema "$PROMPTS_DIR" \
  --schema="$SCRIPT_DIR/registry_command_schema.json" \
  --template="$SCRIPT_DIR/registry_command_template.json" \
  --destination="$OUTPUT_DIR/commands.json" \
  --verbose

echo ""
echo "=== Stage 2: Create registry structure ==="

# Now we need to wrap the commands into the registry structure
# This requires a custom processing step
node -e "
const fs = require('fs');
const path = require('path');

// Read the commands output
const commandsFile = path.join('$OUTPUT_DIR', 'commands.json');
const commands = JSON.parse(fs.readFileSync(commandsFile, 'utf-8'));

// Extract unique c1 values for availableConfigs
const uniqueC1 = [...new Set(commands.map(cmd => cmd.c1).filter(Boolean))];

// Create the registry structure
const registry = {
  version: '1.0.0',
  description: 'Climpt Command Registry',
  tools: {
    availableConfigs: uniqueC1,
    commands: commands
  }
};

// Write the final output
fs.writeFileSync('$FINAL_OUTPUT', JSON.stringify(registry, null, 2));
console.log('Registry created at: $FINAL_OUTPUT');
console.log('Available configs:', uniqueC1.join(', '));
console.log('Total commands:', commands.length);
"

echo ""
echo "=== Processing complete ==="
echo "Output saved to: $FINAL_OUTPUT"