#!/bin/bash

# github status check
scripts/check-github-status.sh
exit_status=$?

if [ $exit_status -eq 2 ]; then 
    echo '{"decision": "block", "reason": "Issues and PRs are still open. Run deno test ci and Create 200 - 300 letters current situation and \"things to be done\" message. then, run [climpt-meta resolve registered-commands <<<\"created_message\"]. After running the climpt-meta, get another climpt-* shown. Finally, run it. (Rule: If the last executed command is climpt-*, act according to its output.)"}'
else 
    # ci status check
    scripts/ci-with-issue-creation.sh
    ci_status=$?

    # Check if CI script was successful
    if [ $ci_status -ne 0 ]; then
        echo '{"decision": "block", "reason": "CI failed. Please fix the issues and try again."}'
    else 
        echo '{"continue": false, "stopReason": "No Issue and PR. CI passed.", "suppressOutput": true}'
    fi
fi