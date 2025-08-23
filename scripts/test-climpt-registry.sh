#!/bin/bash

# Execute frontmatter-to-schema command with specified parameters
frontmatter-to-schema .agent/test-climpt/prompts \
  --schema=.agent/test-climpt/registry_schema.json \
  --template=.agent/test-climpt/registry_template.json \
  --destination=.agent/test-climpt/registed-commands.json \
  --verbose

# Capture the exit status
EXIT_STATUS=$?

# Return exit status 0 or 2
if [ $EXIT_STATUS -eq 0 ] || [ $EXIT_STATUS -eq 2 ]; then
  exit $EXIT_STATUS
else
  # If exit status is neither 0 nor 2, return 2
  exit 2
fi