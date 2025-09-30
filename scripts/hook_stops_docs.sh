#!/bin/bash

# Check if there are any RELEASE branch issues
scripts/check-release-issue.sh > /dev/null 2>&1
exit_status=$?

# Check if there are 5 or more open issues
scripts/check-issue-count.sh > /dev/null 2>&1
issue_count_status=$?


if [ $exit_status -ne 2 ]; then
    # Release issue found - normal stop
    echo '{"continue": false, "stopReason": "Release Issue Found.", "suppressOutput": true}'
elif [ $issue_count_status -eq 0 ]; then
    # 5 or more issues found - normal stop
    echo '{"continue": false, "stopReason": "5 or more open issues found.", "suppressOutput": true}'
else
    # No release issue and less than 5 issues - block with instruction
    echo '{"decision": "block", "reason": "Run `inspector-debug analyze-deep project-issues`. After running the inspector-debug, follow the instruction."}'
fi
exit 2
