#!/bin/bash

# Script to check if there are any GitHub Issues with "release" label
# Returns exit status 0 if found, exit status 2 if not found

set -euo pipefail

# Use gh CLI to search for issues with "release" label
# Redirect stderr to avoid noise, use short timeout
if RESULT=$(timeout 20s gh issue list --label "release" --limit 1 --json number 2>/dev/null); then
    if echo "$RESULT" | jq -e '. | length > 0' >/dev/null 2>&1; then
        exit 0
    else
        exit 2
    fi
else
    exit 1
fi
