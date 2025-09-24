#!/bin/bash
# Daily Sync Check - Prevents large-scale merge conflicts
# Part of Issue #1034 resolution for workflow optimization

set -e

echo "📊 Daily Develop→Main Sync Check"
echo "=================================="

# Fetch latest changes
git fetch origin main develop

# Calculate branch metrics
COMMITS_AHEAD=$(git rev-list --count origin/develop ^origin/main)
COMMITS_BEHIND=$(git rev-list --count origin/main ^origin/develop)
FILES_CHANGED=$(git diff --name-only origin/main origin/develop | wc -l)

echo "📈 Branch Status:"
echo "   Develop ahead: $COMMITS_AHEAD commits"
echo "   Develop behind: $COMMITS_BEHIND commits"
echo "   Files changed: $FILES_CHANGED files"

# Check merge feasibility
MERGE_BASE=$(git merge-base origin/develop origin/main)
git merge-tree $MERGE_BASE origin/develop origin/main > /tmp/merge_analysis.txt

if [ -s /tmp/merge_analysis.txt ]; then
    CONFLICT_FILES=$(grep -c "<<<<<<< " /tmp/merge_analysis.txt || echo 0)
    echo "⚠️  Potential conflicts detected: $CONFLICT_FILES files"
    echo "📋 Conflict preview:"
    head -20 /tmp/merge_analysis.txt
else
    echo "✅ Clean merge possible - no conflicts detected"
fi

# Warning thresholds
if [ $COMMITS_BEHIND -gt 10 ]; then
    echo "🔔 WARNING: Develop branch significantly behind main ($COMMITS_BEHIND commits)"
    echo "   Recommendation: Sync develop with main soon"
fi

if [ $COMMITS_AHEAD -gt 20 ]; then
    echo "🔔 WARNING: Develop branch significantly ahead ($COMMITS_AHEAD commits)"
    echo "   Recommendation: Consider integration to main"
fi

if [ $FILES_CHANGED -gt 50 ]; then
    echo "🔔 WARNING: Large number of changed files ($FILES_CHANGED)"
    echo "   Recommendation: Review for potential conflicts"
fi

# Architecture change detection
DOMAIN_FILES_CHANGED=$(git diff --name-only origin/main origin/develop | grep "src/domain" | wc -l)
if [ $DOMAIN_FILES_CHANGED -gt 10 ]; then
    echo "🏗️  NOTICE: Significant domain changes detected ($DOMAIN_FILES_CHANGED files)"
    echo "   Recommendation: Verify DDD/Totality compliance"
fi

echo "📅 Next check: $(date -v+1d +%Y-%m-%d)"
echo "=================================="

# Cleanup
rm -f /tmp/merge_analysis.txt