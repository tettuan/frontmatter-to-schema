#!/bin/bash
# Conflict Resolution Helper - Systematic approach to merge conflicts
# Part of Issue #1034 resolution for workflow optimization

set -e

echo "🔧 Git Conflict Resolution Assistant"
echo "===================================="

# Check current branch status
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

# Verify we're in a clean state
if ! git diff-index --quiet HEAD --; then
    echo "❌ Working directory not clean. Please commit or stash changes first."
    exit 1
fi

# Create conflict resolution branch
RESOLUTION_BRANCH="sync/conflict-resolution-$(date +%Y%m%d-%H%M)"
echo "🌟 Creating resolution branch: $RESOLUTION_BRANCH"
git checkout -b $RESOLUTION_BRANCH

# Fetch latest changes
echo "🔄 Fetching latest changes..."
git fetch origin main develop

# Pre-merge analysis
echo "📊 Pre-merge analysis:"
MERGE_BASE=$(git merge-base HEAD origin/main)
echo "   Merge base: $MERGE_BASE"

git merge-tree $MERGE_BASE HEAD origin/main > /tmp/conflict_preview.txt
if [ -s /tmp/conflict_preview.txt ]; then
    CONFLICT_COUNT=$(grep -c "<<<<<<< " /tmp/conflict_preview.txt || echo 0)
    echo "   Predicted conflicts: $CONFLICT_COUNT files"
else
    echo "   No conflicts predicted"
fi

# Attempt merge
echo "🔀 Attempting merge with main..."
if git merge origin/main --no-commit --no-ff; then
    echo "✅ Clean merge successful"

    # Run validation
    echo "🧪 Running validation tests..."
    if deno task ci; then
        echo "✅ All tests passing"
        echo "📝 Ready for commit"
    else
        echo "❌ Tests failing - manual intervention required"
        git merge --abort
        exit 1
    fi
else
    echo "⚠️  Merge conflicts detected - manual resolution required"
    echo ""
    echo "🔧 Conflict Resolution Checklist:"
    echo "================================"
    echo "1. ✅ Resolve conflicts in affected files"
    echo "2. ✅ Preserve DDD/Totality architecture patterns"
    echo "3. ✅ Maintain Smart Constructor usage"
    echo "4. ✅ Keep Result<T,E> error handling"
    echo "5. ✅ Verify domain boundaries remain clean"
    echo "6. ✅ Run 'deno task ci' to validate"
    echo "7. ✅ Update documentation if needed"
    echo "8. ✅ Test architectural compliance"
    echo ""
    echo "📋 Affected files:"
    git status --porcelain | grep "^UU\|^AA\|^DD" | awk '{print "   " $2}'
    echo ""
    echo "🛠️  Resolution commands:"
    echo "   # After resolving conflicts:"
    echo "   git add ."
    echo "   git commit -m 'resolve: Merge conflicts with main'"
    echo "   deno task ci"
    echo "   # If tests pass:"
    echo "   git checkout $CURRENT_BRANCH"
    echo "   git merge $RESOLUTION_BRANCH"
    echo "   git branch -d $RESOLUTION_BRANCH"
fi

echo ""
echo "📚 Documentation: docs/development/git-workflow-optimization.md"
echo "🔗 Issue: #1034 - Development Workflow Optimization"
echo "===================================="

# Cleanup temporary files
rm -f /tmp/conflict_preview.txt