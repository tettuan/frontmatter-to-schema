#!/bin/bash
# scripts/analyze-resolution-integrity.sh
# Comprehensive Development Process Integrity Analysis

echo "📊 Development Process Integrity Analysis"
echo "========================================"

# Data collection
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="tmp/resolution-integrity-${TIMESTAMP}.log"
mkdir -p tmp

{
    echo "Resolution Integrity Report - $(date)"
    echo "========================================"
    echo ""

    # Recent activity analysis
    echo "=== Recent Resolution Activity ==="
    echo "Fix/Complete/Resolve commits (last 7 days):"
    git log --oneline --since="7 days ago" | grep -E "(fix|complete|resolve)" | nl
    echo ""

    echo "Recently closed issues (last 3 days):"
    gh issue list --state closed --search "closed:>$(date -d '3 days ago' +%Y-%m-%d)" --json number,title,closedAt | jq -r '.[] | "\(.number)\t\(.closedAt)\t\(.title)"'
    echo ""

    # Technical status
    echo "=== Current Technical Status ==="

    echo -n "TypeScript type check: "
    if deno check **/*.ts > /dev/null 2>&1; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
    fi

    echo -n "Tests: "
    if deno test --allow-all --no-check > /dev/null 2>&1; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
    fi

    # Architecture compliance
    THROW_COUNT=$(find . -name "*.ts" -type f | xargs grep -l "throw new Error" | wc -l)
    CONSOLE_COUNT=$(find . -name "*.ts" -type f | xargs grep -l "console\." | wc -l)

    echo "Architecture violations:"
    echo "  Direct throws: $THROW_COUNT files"
    echo "  Console usage: $CONSOLE_COUNT files"
    echo ""

    # Issue tracking integrity
    echo "=== Issue Tracking Integrity ==="
    OPEN_BUGS=$(gh issue list --state open --label "bug" --json number | jq length)
    OPEN_CRITICAL=$(gh issue list --state open --label "high-priority" --json number | jq length)

    echo "Open bugs: $OPEN_BUGS"
    echo "Open critical issues: $OPEN_CRITICAL"
    echo ""

    # Contradiction analysis
    echo "=== Contradiction Analysis ==="
    FIX_COMMITS=$(git log --oneline --since="7 days ago" | grep -E "(fix|complete|resolve)" | wc -l)

    echo "Fix claims (7 days): $FIX_COMMITS"
    echo "Current problems: $OPEN_BUGS bugs, $OPEN_CRITICAL critical"

    # Risk assessment
    echo ""
    echo "=== Risk Assessment ==="

    RISK_SCORE=0

    if ! deno check **/*.ts > /dev/null 2>&1; then
        RISK_SCORE=$((RISK_SCORE + 3))
        echo "⚠️  Type check failing (+3 risk)"
    fi

    if [ $THROW_COUNT -gt 50 ]; then
        RISK_SCORE=$((RISK_SCORE + 2))
        echo "⚠️  High architecture violations (+2 risk)"
    fi

    if [ $FIX_COMMITS -gt 5 ] && [ $OPEN_CRITICAL -gt $FIX_COMMITS ]; then
        RISK_SCORE=$((RISK_SCORE + 3))
        echo "⚠️  High fix claims vs remaining issues (+3 risk)"
    fi

    echo ""
    echo "Total Risk Score: $RISK_SCORE/10"

    if [ $RISK_SCORE -ge 6 ]; then
        echo "🚨 HIGH RISK: False resolution claims likely"
    elif [ $RISK_SCORE -ge 3 ]; then
        echo "⚠️  MEDIUM RISK: Process integrity concerns"
    else
        echo "✅ LOW RISK: Process appears healthy"
    fi

} | tee "$REPORT_FILE"

echo ""
echo "📄 Full report saved to: $REPORT_FILE"