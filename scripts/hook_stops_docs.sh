#!/bin/bash

# Check if there are any RELEASE branch issues
scripts/check-release-issue.sh > /dev/null 2>&1
exit_status=$?

if [ $exit_status -eq 2 ]; then 
    echo '{"decision": "block", "reason": "Run [climpt-debug analyze-deep project-issues]. After running the climpt-debug, follow the instruction."}'
else 
    echo '{"continue": false, "stopReason": "Release Issue Found.", "suppressOutput": true}'
fi