#!/bin/bash
# Test execution script with breakdownlogger support
# Usage examples:
# ./scripts/test-with-debug.sh base-property-population  # Specific component debug
# ./scripts/test-with-debug.sh base-property-population,processing  # Multiple components
# LOG_LENGTH=L ./scripts/test-with-debug.sh all  # Long format for all tests
# LOG_LENGTH=W ./scripts/test-with-debug.sh schema-validation  # Whole message format

set -e

# Default values
TEST_KEY=${1:-"all"}
LOG_LEVEL=${LOG_LEVEL:-"debug"}
LOG_LENGTH=${LOG_LENGTH:-"S"}

echo "🧪 Running tests with breakdownlogger configuration:"
echo "   LOG_KEY: $TEST_KEY"
echo "   LOG_LEVEL: $LOG_LEVEL"
echo "   LOG_LENGTH: $LOG_LENGTH"
echo ""

if [ "$TEST_KEY" = "all" ]; then
    echo "🔍 Running all tests with debug logging"
    LOG_LEVEL="$LOG_LEVEL" LOG_LENGTH="$LOG_LENGTH" deno test --allow-all
else
    echo "🔍 Running tests filtered by KEY: $TEST_KEY"
    LOG_KEY="$TEST_KEY" LOG_LEVEL="$LOG_LEVEL" LOG_LENGTH="$LOG_LENGTH" deno test --allow-all
fi

echo ""
echo "✅ Test execution completed"
echo "💡 Tip: Use different LOG_LENGTH values:"
echo "   S=160 chars (Short, default)"
echo "   L=300 chars (Long)"
echo "   W=whole message (Complete)"
echo ""
echo "💡 Tip: Filter by multiple keys:"
echo "   ./scripts/test-with-debug.sh 'base-property-population,schema-validation'"