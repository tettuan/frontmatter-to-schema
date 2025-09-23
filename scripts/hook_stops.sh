#!/bin/bash

# ci status check
scripts/ci-with-issue-creation.sh
ci_status=$?
# Check if CI script was successful
if [ $ci_status -ne 0 ]; then
    echo '{"decision": "block", "reason": "CI failed. Run deno task ci and please fix the issues and try again."}'
    exit 2
fi

# github status check
scripts/check-github-status.sh
exit_status=$?

if [ $exit_status -eq 2 ]; then
    echo '{"decision": "block", "reason": "Issues and PRs are still open. Run `deno task ci` and Create 200 - 300 letters current situation and \"things to be done\" message. then, run [climpt-meta resolve registered-commands <<<\"created_message\"]. After running the climpt-meta, get another climpt-* shown. Finally, run it and follow the instruction shown. (Rule: If the last executed command is climpt-*, act according to its output.)"}'
else
    echo '{"continue": false, "stopReason": "No Issue and PR. CI passed.", "suppressOutput": true}'
fi
