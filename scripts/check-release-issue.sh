#!/bin/bash

# Script to check if there are any GitHub Issues with "release" label
# Exit statuses:
#   0: Open release issues found
#   1: Command failed (network error, timeout, etc.)
#   2: No open release issues found

set -euo pipefail

# Use gh CLI to search for open issues with "release" label
# Redirect stderr to avoid noise, use short timeout
if RESULT=$(timeout 20s gh issue list --state open --label "release" --limit 1 --json number 2>/dev/null); then
    if echo "$RESULT" | jq -e '. | length > 0' >/dev/null 2>&1; then
        exit 0  # Found open release issues
    else
        exit 2  # No open release issues found
    fi
else
    exit 1  # Command failed (network error, timeout, etc.)
fi
