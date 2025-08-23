#!/bin/bash

# Execute frontmatter-to-schema command
frontmatter-to-schema .agent/test-climpt/prompts \
  --schema=.agent/test-climpt/registry_schema.json \
  --template=.agent/test-climpt/registry_template.json \
  --destination=.agent/test-climpt/registed-commands.json \
  --verbose > /dev/null 2>&1

# Return the exit status
exit $?