#!/bin/bash
# scripts/detect-false-claims.sh
# False Resolution Claims Detection Script

echo "🔍 False Resolution Claims Detection"
echo "=================================="

# Recent claims analysis
echo "=== Recent Resolution Claims ==="
RECENT_CLAIMS=$(git log --oneline --since="3 days ago" | grep -E "(fix|complete|resolve)")
if [ -n "$RECENT_CLAIMS" ]; then
    echo "$RECENT_CLAIMS" | nl
    echo ""

    # Technical verification
    echo "=== Technical Reality Check ==="

    TYPE_STATUS="FAIL"
    TEST_STATUS="FAIL"

    if deno check **/*.ts > /dev/null 2>&1; then
        TYPE_STATUS="PASS"
    fi

    if deno test --allow-all --no-check > /dev/null 2>&1; then
        TEST_STATUS="PASS"
    fi

    echo "Type Check: $TYPE_STATUS"
    echo "Tests: $TEST_STATUS"

    # Architecture violations
    VIOLATIONS=$(find . -name "*.ts" -type f | xargs grep -l "throw new Error" | wc -l)
    echo "Architecture violations: $VIOLATIONS files"

    # Issue status
    OPEN_CRITICAL=$(gh issue list --state open --label "high-priority" --json number | jq length)
    echo "Open critical issues: $OPEN_CRITICAL"

    # Detection logic
    FALSE_CLAIM_DETECTED=false

    if [[ "$TYPE_STATUS" == "FAIL" ]] || [[ "$TEST_STATUS" == "FAIL" ]]; then
        FALSE_CLAIM_DETECTED=true
    fi

    if [[ $VIOLATIONS -gt 50 ]] || [[ $OPEN_CRITICAL -gt 5 ]]; then
        FALSE_CLAIM_DETECTED=true
    fi

    if [ "$FALSE_CLAIM_DETECTED" = true ]; then
        echo ""
        echo "🚨 POTENTIAL FALSE CLAIMS DETECTED"
        echo "Recent commits claim fixes but problems persist"
        echo ""
        echo "Recommended actions:"
        echo "1. Verify claimed fixes actually work"
        echo "2. Update commit messages to reflect partial progress"
        echo "3. Reopen prematurely closed issues"
    else
        echo ""
        echo "✅ Resolution claims appear legitimate"
    fi
else
    echo "No recent resolution claims found"
fi