#!/bin/bash

echo "=== x-flatten-arrays Debugging Workflow ==="

# Environment setup
export LOG_KEY=${LOG_KEY:-"x-flatten-arrays-integration"}
export LOG_LEVEL=${LOG_LEVEL:-"debug"}
export LOG_LENGTH=${LOG_LENGTH:-"L"}
mkdir -p tmp/

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="tmp/debug-x-flatten-arrays-${TIMESTAMP}.log"

echo "Environment configured:"
echo "  LOG_KEY: $LOG_KEY"
echo "  LOG_LEVEL: $LOG_LEVEL"
echo "  LOG_LENGTH: $LOG_LENGTH"
echo "  LOG_FILE: $LOG_FILE"
echo ""

# Step 1: Type check verification
echo "=== Step 1: Type Check Verification ==="
echo "Verifying TypeScript compilation..."
if deno check src/**/*.ts; then
    echo "✅ Type check PASSED"
else
    echo "❌ Type check FAILED"
    exit 1
fi
echo ""

# Step 2: Current test status
echo "=== Step 2: Current Test Status ==="
echo "Running x-flatten-arrays integration test with logging..."

# Run test with BreakdownLogger environment
if LOG_KEY="$LOG_KEY" LOG_LEVEL="$LOG_LEVEL" LOG_LENGTH="$LOG_LENGTH" \
   deno test --allow-all tests/integration/x-flatten-arrays-directive-integration_test.ts 2>&1 | tee "$LOG_FILE"; then
    echo "✅ Test execution completed (check results above)"
else
    echo "❌ Test execution failed"
fi
echo ""

# Step 3: Detailed analysis
echo "=== Step 3: Analysis ==="
echo "Log file created: $LOG_FILE"

# Check if BreakdownLogger output exists in a temporary location
if [ -f "$LOG_FILE" ]; then
    echo "Debug information captured in: $LOG_FILE"

    # Extract key information from logs
    echo ""
    echo "=== Key Debug Information ==="
    if grep -q "Processing result analysis" "$LOG_FILE"; then
        echo "Found processing result analysis in logs"
        grep -A 10 "Processing result analysis" "$LOG_FILE" || true
    else
        echo "No processing result analysis found in logs"
    fi

    if grep -q "Expected vs Actual comparison" "$LOG_FILE"; then
        echo ""
        echo "Found expected vs actual comparison:"
        grep -A 10 "Expected vs Actual comparison" "$LOG_FILE" || true
    else
        echo "No comparison data found in logs"
    fi
else
    echo "No detailed log file found"
fi

echo ""
echo "=== Summary ==="
echo "Debugging workflow completed. Check the log file for detailed analysis:"
echo "  $LOG_FILE"
echo ""
echo "Next steps:"
echo "1. Analyze the log output to identify root cause"
echo "2. Check processing result analysis for data structure issues"
echo "3. Compare expected vs actual to understand the mismatch"
echo "4. Focus on x-flatten-arrays directive implementation in DirectiveProcessor"