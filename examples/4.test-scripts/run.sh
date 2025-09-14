#!/bin/bash

# Test Scripts Runner
# Usage: ./run.sh [legacy|new|all]
# Default: all

TEST_MODE="${1:-all}"

echo "=== Test Scripts Runner ==="
echo "Mode: $TEST_MODE"
echo

run_legacy_test() {
    echo "Running Legacy CLI Test (climpt-registry)..."

    # Test configuration - using legacy CLI format
    TEST_REGISTRY_SCHEMA="./examples/climpt-registry/schema.json"
    TEST_REGISTRY_TEMPLATE="./examples/climpt-registry/template.json"
    TEST_PROMPTS_DIR="./.agent/climpt/prompts"
    TEST_OUTPUT_FILE="./tmp/test-output-legacy.json"

    # Create tmp directory if it doesn't exist
    mkdir -p tmp

    # Check if legacy CLI format is available (this is for backward compatibility testing)
    # Execute frontmatter-to-schema command with legacy parameters
    frontmatter-to-schema "$TEST_PROMPTS_DIR" \
      --schema="$TEST_REGISTRY_SCHEMA" \
      --template="$TEST_REGISTRY_TEMPLATE" \
      --destination="$TEST_OUTPUT_FILE" \
      --verbose

    # Capture the exit status
    local EXIT_STATUS=$?

    if [ $EXIT_STATUS -eq 0 ] || [ $EXIT_STATUS -eq 2 ]; then
        echo "✅ Legacy test completed (exit: $EXIT_STATUS)"
        return $EXIT_STATUS
    else
        echo "❌ Legacy test failed (exit: $EXIT_STATUS)"
        return 2
    fi
}

run_new_test() {
    echo "Running New CLI Test via examples/2.climpt/run.sh..."

    # Delegate to the climpt example runner
    cd examples/2.climpt && ./run.sh
    local EXIT_STATUS=$?

    cd ../..

    if [ $EXIT_STATUS -eq 0 ]; then
        echo "✅ New test completed (exit: $EXIT_STATUS)"
        return 0
    else
        echo "❌ New test failed (exit: $EXIT_STATUS)"
        return 2
    fi
}

# Main execution
case "$TEST_MODE" in
    "legacy")
        run_legacy_test
        exit $?
        ;;
    "new")
        run_new_test
        exit $?
        ;;
    "all")
        echo "Running both tests..."
        echo

        echo "1. Testing new CLI (via examples/2.climpt/run.sh)..."
        run_new_test
        NEW_RESULT=$?
        echo

        echo "2. Testing legacy CLI (if available)..."
        run_legacy_test 2>/dev/null
        LEGACY_RESULT=$?
        echo

        echo "=== Results Summary ==="
        echo "New CLI: $([ $NEW_RESULT -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL") (exit: $NEW_RESULT)"
        echo "Legacy CLI: $([ $LEGACY_RESULT -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL") (exit: $LEGACY_RESULT)"

        # Return success if new test passes (prioritize new CLI)
        if [ $NEW_RESULT -eq 0 ]; then
            exit 0
        else
            exit 2
        fi
        ;;
    *)
        echo "Usage: $0 [legacy|new|all]"
        echo "  legacy: Run only legacy CLI test"
        echo "  new: Run only new CLI test (via examples/2.climpt/run.sh)"
        echo "  all: Run both tests (default)"
        exit 1
        ;;
esac