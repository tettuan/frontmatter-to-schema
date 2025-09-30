#!/bin/bash
# Check GitHub issues and PRs status

# Check for open issues
issue_count=$(gh issue list --state open --json number --jq 'length' 2>/dev/null || echo "0")

# Check for open PRs
pr_count=$(gh pr list --state open --json number --jq 'length' 2>/dev/null || echo "0")

if [ "$issue_count" -gt 0 ] || [ "$pr_count" -gt 0 ]; then
    echo "Found $issue_count open issues and $pr_count open PRs"
    exit 2
else
    echo "No open issues or PRs"
    exit 0
fi
