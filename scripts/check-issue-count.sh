#!/bin/bash

# Script to check if there are 5 or more open GitHub Issues
# Returns exit status 0 (true) if 5+ issues found, exit status 1 (false) if less than 5
# Exit status 2 for errors

set -euo pipefail

# Threshold for issue count
THRESHOLD=5

# Use gh CLI to get open issues count
# Redirect stderr to avoid noise, use short timeout
if RESULT=$(timeout 20s gh issue list --state open --limit 100 --json number 2>/dev/null); then
    # Count the number of issues
    COUNT=$(echo "$RESULT" | jq '. | length')

    if [ "$COUNT" -ge "$THRESHOLD" ]; then
        # echo "Found $COUNT open issues (threshold: $THRESHOLD)"
        exit 0  # true - 5 or more issues
    else
        # echo "Found $COUNT open issues (threshold: $THRESHOLD)"
        exit 1  # false - less than 5 issues
    fi
else
    # echo "Error: Failed to fetch issues from GitHub"
    exit 2  # error
fi
