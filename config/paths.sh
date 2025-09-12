#!/bin/bash

# Configuration paths for frontmatter-to-schema testing
# Based on project structure analysis

# Test registry schema (climpt registry example)
export TEST_REGISTRY_SCHEMA="./examples/climpt-registry/schema.json"

# Test registry template  
export TEST_REGISTRY_TEMPLATE="./examples/climpt-registry/template.json"

# Test prompts directory (climpt agent prompts)
export TEST_PROMPTS_DIR="./.agent/climpt/prompts"

# Test output file location
export TEST_OUTPUT_FILE="./tmp/test-output.json"