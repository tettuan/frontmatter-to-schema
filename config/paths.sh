#!/bin/bash
# Path Configuration for Shell Scripts
# 
# This file centralizes all path configurations used in shell scripts
# to eliminate hardcoding and improve maintainability.
# Source this file in other scripts: source config/paths.sh

# Base directories
export BASE_DIR="${BASE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
export AGENT_DIR="${AGENT_DIR:-$BASE_DIR/.agent}"
export EXAMPLES_DIR="${EXAMPLES_DIR:-$BASE_DIR/examples}"
export SCRIPTS_DIR="${SCRIPTS_DIR:-$BASE_DIR/scripts}"

# Registry paths
export REGISTRY_PROMPTS_PATH="${REGISTRY_PROMPTS_PATH:-$AGENT_DIR/climpt/prompts}"
export REGISTRY_OUTPUT_PATH="${REGISTRY_OUTPUT_PATH:-$AGENT_DIR/climpt/registry.json}"
export REGISTRY_COMMAND_SCHEMA="${REGISTRY_COMMAND_SCHEMA:-registry_command_schema.json}"
export REGISTRY_COMMAND_TEMPLATE="${REGISTRY_COMMAND_TEMPLATE:-registry_command_template.json}"
export REGISTRY_SCHEMA="${REGISTRY_SCHEMA:-registry_schema.json}"
export REGISTRY_TEMPLATE="${REGISTRY_TEMPLATE:-registry_template.json}"

# Test paths
export TEST_DIR="${TEST_DIR:-$AGENT_DIR/test-climpt}"
export TEST_PROMPTS_DIR="${TEST_PROMPTS_DIR:-$TEST_DIR/prompts}"
export TEST_COMMAND_SCHEMA="${TEST_COMMAND_SCHEMA:-$TEST_DIR/$REGISTRY_COMMAND_SCHEMA}"
export TEST_COMMAND_TEMPLATE="${TEST_COMMAND_TEMPLATE:-$TEST_DIR/$REGISTRY_COMMAND_TEMPLATE}"
export TEST_REGISTRY_SCHEMA="${TEST_REGISTRY_SCHEMA:-$TEST_DIR/$REGISTRY_SCHEMA}"
export TEST_REGISTRY_TEMPLATE="${TEST_REGISTRY_TEMPLATE:-$TEST_DIR/$REGISTRY_TEMPLATE}"
export TEST_OUTPUT_FILE="${TEST_OUTPUT_FILE:-$TEST_DIR/registed-commands.json}"

# Example paths
export CLIMPT_REGISTRY_DIR="${CLIMPT_REGISTRY_DIR:-$EXAMPLES_DIR/climpt-registry}"
export CLIMPT_REGISTRY_SCHEMA="${CLIMPT_REGISTRY_SCHEMA:-$CLIMPT_REGISTRY_DIR/schema.json}"
export CLIMPT_REGISTRY_TEMPLATE="${CLIMPT_REGISTRY_TEMPLATE:-$CLIMPT_REGISTRY_DIR/template.json}"

export ARTICLES_INDEX_DIR="${ARTICLES_INDEX_DIR:-$EXAMPLES_DIR/articles-index}"
export ARTICLES_INDEX_SCHEMA="${ARTICLES_INDEX_SCHEMA:-$ARTICLES_INDEX_DIR/schema.json}"
export ARTICLES_INDEX_TEMPLATE="${ARTICLES_INDEX_TEMPLATE:-$ARTICLES_INDEX_DIR/template.yaml}"

export SAMPLE_DOCS_DIR="${SAMPLE_DOCS_DIR:-$EXAMPLES_DIR/sample-docs}"
export EXAMPLES_OUTPUT_DIR="${EXAMPLES_OUTPUT_DIR:-$EXAMPLES_DIR/output}"

# Alternative structure paths
export ALT_STRUCTURE_DIR="${ALT_STRUCTURE_DIR:-$EXAMPLES_DIR/alternative-structure}"
export ALT_COMMANDS_DIR="${ALT_COMMANDS_DIR:-$ALT_STRUCTURE_DIR/commands}"

# Output directories
export OUTPUT_ADVANCED_DIR="${OUTPUT_ADVANCED_DIR:-$EXAMPLES_OUTPUT_DIR/advanced}"
export OUTPUT_ALTERNATIVE_DIR="${OUTPUT_ALTERNATIVE_DIR:-$EXAMPLES_OUTPUT_DIR/alternative}"

# Tools and lists
export TOOLS_LIST_FILE="${TOOLS_LIST_FILE:-$AGENT_DIR/climpt/tools-list.md}"

# Function to validate required paths exist
validate_paths() {
    local paths=("$@")
    local missing=()
    
    for path in "${paths[@]}"; do
        if [[ ! -e "$path" ]]; then
            missing+=("$path")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Error: Missing required paths:" >&2
        printf '%s\n' "${missing[@]}" >&2
        return 1
    fi
    
    return 0
}

# Function to create output directories if they don't exist
ensure_output_dirs() {
    local dirs=(
        "$EXAMPLES_OUTPUT_DIR"
        "$OUTPUT_ADVANCED_DIR"
        "$OUTPUT_ALTERNATIVE_DIR"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done
}

# Export functions
export -f validate_paths
export -f ensure_output_dirs