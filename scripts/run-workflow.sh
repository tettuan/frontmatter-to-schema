#!/bin/bash

# Workflow Execution Script with BreakdownLogger Integration
# Usage: ./scripts/run-workflow.sh <workflow-file> [workflow-type] [target-scope]

set -euo pipefail

# Default values
WORKFLOW_FILE=${1:-""}
WORKFLOW_TYPE=${2:-"debug"}
TARGET_SCOPE=${3:-"component"}

# Validation
if [[ -z "$WORKFLOW_FILE" ]]; then
    echo "❌ Error: Workflow file is required"
    echo "Usage: $0 <workflow-file> [workflow-type] [target-scope]"
    echo ""
    echo "Examples:"
    echo "  $0 docs/tests/debugs/integration/test-design-misalignment.workflow.md debug integration"
    echo "  $0 docs/tests/debugs/component/deprecated-directive-cleanup.workflow.md cleanup component"
    exit 1
fi

if [[ ! -f "$WORKFLOW_FILE" ]]; then
    echo "❌ Error: Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

# Extract workflow ID from filename
WORKFLOW_ID=$(basename "$WORKFLOW_FILE" .workflow.md)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Environment variables setup for BreakdownLogger
export LOG_KEY="workflow-${WORKFLOW_TYPE}-${WORKFLOW_ID}"
export LOG_LENGTH=${LOG_LENGTH:-"L"}
export LOG_LEVEL=${LOG_LEVEL:-"debug"}

# Create tmp directory if it doesn't exist
mkdir -p tmp

# Log files
DEBUG_LOG="tmp/debug-${WORKFLOW_ID}-${TIMESTAMP}.log"
EVIDENCE_FILE="tmp/evidence-${WORKFLOW_ID}.json"

echo "=================================================="
echo "🚀 Workflow Execution Starting"
echo "=================================================="
echo "Workflow File: $WORKFLOW_FILE"
echo "Workflow Type: $WORKFLOW_TYPE"
echo "Target Scope:  $TARGET_SCOPE"
echo "Log Key:       $LOG_KEY"
echo "Log Level:     $LOG_LEVEL"
echo "Debug Log:     $DEBUG_LOG"
echo "Evidence:      $EVIDENCE_FILE"
echo "=================================================="

# Create evidence file with initial metadata
cat > "$EVIDENCE_FILE" << EOF
{
  "workflow_execution": {
    "workflow_id": "$WORKFLOW_ID",
    "workflow_type": "$WORKFLOW_TYPE",
    "target_scope": "$TARGET_SCOPE",
    "start_time": "$(date -Iseconds)",
    "log_key": "$LOG_KEY",
    "log_level": "$LOG_LEVEL",
    "status": "running",
    "steps_completed": [],
    "errors": []
  }
}
EOF

# Function to log step completion
log_step_completion() {
    local step_id="$1"
    local status="$2"
    local details="$3"

    echo "✅ Step $step_id: $status"
    echo "$details" | tee -a "$DEBUG_LOG"

    # Update evidence file
    jq --arg step_id "$step_id" --arg status "$status" --arg details "$details" \
       '.workflow_execution.steps_completed += [{"step_id": $step_id, "status": $status, "details": $details, "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S")}]' \
       "$EVIDENCE_FILE" > "${EVIDENCE_FILE}.tmp" && mv "${EVIDENCE_FILE}.tmp" "$EVIDENCE_FILE"
}

# Function to log errors
log_error() {
    local error_msg="$1"
    echo "❌ Error: $error_msg" | tee -a "$DEBUG_LOG"

    # Update evidence file
    jq --arg error "$error_msg" \
       '.workflow_execution.errors += [{"error": $error, "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S")}]' \
       "$EVIDENCE_FILE" > "${EVIDENCE_FILE}.tmp" && mv "${EVIDENCE_FILE}.tmp" "$EVIDENCE_FILE"
}

# Workflow-specific execution based on workflow type
execute_workflow() {
    case "$WORKFLOW_TYPE" in
        "debug"|"integration")
            execute_debug_workflow
            ;;
        "cleanup"|"component")
            execute_cleanup_workflow
            ;;
        "test")
            execute_test_workflow
            ;;
        *)
            execute_generic_workflow
            ;;
    esac
}

# Execute debug/integration workflow
execute_debug_workflow() {
    echo "🔍 Executing Debug/Integration Workflow"

    # Step 1: Initial verification
    log_step_completion "step1" "starting" "Initial verification and environment check"

    # Check current test status
    if deno test --allow-all --no-check 2>&1 | tail -5 | tee -a "$DEBUG_LOG"; then
        log_step_completion "step1" "completed" "Test status verified successfully"
    else
        log_error "Test execution failed during initial verification"
        return 1
    fi

    # Step 2: Setup debug environment
    log_step_completion "step2" "starting" "Setting up debug environment"

    echo "Environment variables:" | tee -a "$DEBUG_LOG"
    echo "LOG_KEY=$LOG_KEY" | tee -a "$DEBUG_LOG"
    echo "LOG_LEVEL=$LOG_LEVEL" | tee -a "$DEBUG_LOG"
    echo "LOG_LENGTH=$LOG_LENGTH" | tee -a "$DEBUG_LOG"

    log_step_completion "step2" "completed" "Debug environment configured"

    # Step 3: Investigation (workflow-specific)
    if [[ "$WORKFLOW_ID" == "test-design-misalignment-debug" ]]; then
        execute_test_design_investigation
    else
        execute_generic_investigation
    fi
}

# Execute test design misalignment investigation
execute_test_design_investigation() {
    log_step_completion "step3" "starting" "Test design investigation"

    # Find current supported directive tests
    echo "🔍 Searching for current supported directive tests..." | tee -a "$DEBUG_LOG"
    SUPPORTED_DIRECTIVE_TEST_COUNT=$(grep -r "x-frontmatter-part\|x-derived-from\|x-template" tests/ --include="*_test.ts" 2>/dev/null | wc -l)
    echo "Found $SUPPORTED_DIRECTIVE_TEST_COUNT supported directive references in tests" | tee -a "$DEBUG_LOG"

    # Find main function tests
    echo "🔍 Analyzing main function test coverage..." | tee -a "$DEBUG_LOG"
    MAIN_FUNCTION_TESTS=$(grep -l "transformDocuments\|processDocument" tests/**/*_test.ts 2>/dev/null | wc -l)
    echo "Found $MAIN_FUNCTION_TESTS files testing main functions" | tee -a "$DEBUG_LOG"

    # Generate detailed analysis
    cat >> "$DEBUG_LOG" << EOF

=== Test Design Analysis Results ===
Supported directive test references: $SUPPORTED_DIRECTIVE_TEST_COUNT
Main function test files: $MAIN_FUNCTION_TESTS
Analysis timestamp: $(date -Iseconds)

Recommendations:
1. Enhance tests for current supported directives (x-frontmatter-part, x-derived-from, x-template, etc.)
2. Expand main function test coverage
3. Implement 24-pattern execution tests
4. Integrate BreakdownLogger strategy

EOF

    log_step_completion "step3" "completed" "Test design investigation completed"
}

# Execute cleanup workflow
execute_cleanup_workflow() {
    echo "🧹 Executing Cleanup Workflow"

    log_step_completion "step1" "starting" "Supported directive test enhancement investigation"

    # Count current supported directive references
    CURRENT_COUNT=$(find . -name "*.ts" -not -path "./node_modules/*" | xargs grep -l "x-frontmatter-part\|x-derived-from\|x-template" 2>/dev/null | wc -l)
    echo "Current supported directive references: $CURRENT_COUNT files" | tee -a "$DEBUG_LOG"

    # Count test files with supported directives
    TEST_COUNT=$(find . -name "*_test.ts" | xargs grep -l "x-frontmatter-part\|x-derived-from\|x-template" 2>/dev/null | wc -l)
    echo "Test files covering supported directives: $TEST_COUNT files" | tee -a "$DEBUG_LOG"

    # Create detailed usage report
    echo "🔍 Generating detailed usage report..." | tee -a "$DEBUG_LOG"
    find . -name "*.ts" -not -path "./node_modules/*" | xargs grep -n "x-frontmatter-part\|x-derived-from\|x-template\|x-jmespath-filter\|x-template-items\|x-template-format" 2>/dev/null > "tmp/supported-directive-usage-detailed-${TIMESTAMP}.log" || true

    log_step_completion "step1" "completed" "Enhancement investigation completed - $CURRENT_COUNT implementation files, $TEST_COUNT test files identified"

    # Note: Actual test enhancement would be performed manually based on the investigation
    echo "✅ Test enhancement opportunities identified based on investigation results" | tee -a "$DEBUG_LOG"
    echo "📄 Detailed usage report: tmp/supported-directive-usage-detailed-${TIMESTAMP}.log" | tee -a "$DEBUG_LOG"
}

# Execute generic investigation
execute_generic_investigation() {
    log_step_completion "step3" "starting" "Generic investigation"

    # Run basic system checks
    echo "🔍 Running system health checks..." | tee -a "$DEBUG_LOG"

    # TypeScript compilation check
    if deno task check 2>&1 | tee -a "$DEBUG_LOG"; then
        echo "✅ TypeScript compilation successful" | tee -a "$DEBUG_LOG"
    else
        log_error "TypeScript compilation failed"
    fi

    # Test execution
    if deno test --allow-all --no-check 2>&1 | grep -E "(passed|failed)" | tee -a "$DEBUG_LOG"; then
        echo "✅ Test execution completed" | tee -a "$DEBUG_LOG"
    else
        log_error "Test execution encountered issues"
    fi

    log_step_completion "step3" "completed" "Generic investigation completed"
}

# Execute test workflow
execute_test_workflow() {
    echo "🧪 Executing Test Workflow"

    log_step_completion "test" "starting" "Test execution with debugging"

    # Run tests with full debugging
    if LOG_KEY="$LOG_KEY" LOG_LEVEL="$LOG_LEVEL" deno test --allow-all 2>&1 | tee -a "$DEBUG_LOG"; then
        log_step_completion "test" "completed" "Test execution successful"
    else
        log_error "Test execution failed"
        return 1
    fi
}

# Execute generic workflow
execute_generic_workflow() {
    echo "🔧 Executing Generic Workflow"

    log_step_completion "generic" "starting" "Generic workflow execution"

    # Basic workflow steps
    echo "📋 Workflow file analysis:" | tee -a "$DEBUG_LOG"
    if grep -A 5 "## 目的" "$WORKFLOW_FILE" | tee -a "$DEBUG_LOG"; then
        echo "✅ Workflow purpose identified" | tee -a "$DEBUG_LOG"
    fi

    if grep -c "xml:step" "$WORKFLOW_FILE" | tee -a "$DEBUG_LOG"; then
        echo "✅ Workflow steps identified" | tee -a "$DEBUG_LOG"
    fi

    log_step_completion "generic" "completed" "Generic workflow completed"
}

# Main execution
main() {
    # Trap errors and update evidence
    trap 'log_error "Workflow execution interrupted"; update_final_status "interrupted"' ERR
    trap 'update_final_status "completed"' EXIT

    # Execute the workflow
    execute_workflow

    echo ""
    echo "=================================================="
    echo "✅ Workflow Execution Completed"
    echo "=================================================="
    echo "Debug Log: $DEBUG_LOG"
    echo "Evidence:  $EVIDENCE_FILE"
    echo "Log Key:   $LOG_KEY"
    echo "=================================================="
}

# Update final status in evidence file
update_final_status() {
    local status="$1"
    jq --arg status "$status" --arg end_time "$(date -Iseconds)" \
       '.workflow_execution.status = $status | .workflow_execution.end_time = $end_time' \
       "$EVIDENCE_FILE" > "${EVIDENCE_FILE}.tmp" && mv "${EVIDENCE_FILE}.tmp" "$EVIDENCE_FILE"
}

# Run main function
main "$@"