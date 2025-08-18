#!/bin/bash

# Check GitHub PR and issue status
# Returns: 0 if both PRs and issues are 0, 1 otherwise

set -e

# Check if gh command is available
if ! command -v gh &> /dev/null; then
    echo "Error: gh command not found. Please install GitHub CLI." >&2
    exit 2
fi

# Check if authenticated with gh
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI. Please run 'gh auth login'." >&2
    exit 2
fi

# Get PR count
pr_count=$(gh pr list --json number --jq 'length')

# Get issue count  
issue_count=$(gh issue list --json number --jq 'length')

# Return 0 if both are 0, otherwise return 2
if [ "$pr_count" -eq 0 ] && [ "$issue_count" -eq 0 ]; then
    # Clean state - no output
    exit 0
else
    # Issues exist - output hook message
    echo '{"decision": "block", "reason": "create 200 - 300 letters current situation and \"things to be done\" message. then, run [climpt-meta resolve registered-commands <<<\"created_message\"]. After running the climpt-meta, get another climpt-* shown. Finally, run it. (Rule: If the last executed command is climpt-*, act according to its output.)"}'
    exit 2
fi