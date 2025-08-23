#!/bin/bash

# Run deno task ci and capture output and exit code
if output=$(deno task ci 2>&1); then
    exit 0
else
    exit 2
fi 
#     exit_code=$?
    
#     # Extract error details for issue body
#     issue_title="CI Failed - $(date '+%Y-%m-%d %H:%M:%S')"
#     issue_body="## CI Failure Report

# **Date:** $(date '+%Y-%m-%d %H:%M:%S')
# **Exit Code:** $exit_code

# ### Error Output:
# \`\`\`
# $output
# \`\`\`

# ### Steps to Reproduce:
# 1. Run \`deno task ci\`
# 2. Observe the failure

# ### Environment:
# - OS: $(uname -s)
# - Deno Version: $(deno --version | head -n1)

# This issue was automatically created by the CI monitoring script."

#     # Create the issue using gh CLI
#     if command -v gh &> /dev/null; then
#         if gh issue create \
#             --title "$issue_title" \
#             --body "$issue_body" \
#             --label "bug" &> /dev/null; then
#             exit 0
#         else
#             exit 1
#         fi
#     else
#         exit 1
#     fi
# fi