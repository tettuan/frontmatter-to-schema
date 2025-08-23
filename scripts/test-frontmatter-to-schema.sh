#!/bin/bash

# Execute frontmatter-to-schema command with mock analyzer (silent mode)
FRONTMATTER_TO_SCHEMA_TEST_MODE=true ./frontmatter-to-schema .agent/test-climpt/prompts \
  --schema=.agent/test-climpt/registry_schema.json \
  --template=.agent/test-climpt/registry_template.json \
  --destination=.agent/test-climpt/registed-commands.json \
  >/dev/null 2>&1

# Capture the exit status
EXIT_STATUS=$?

# Return exit status 0 or 2
if [ $EXIT_STATUS -eq 0 ]; then
  exit 0
else
  exit 2
fi