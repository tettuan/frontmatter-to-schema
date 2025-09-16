#!/bin/bash

# Test frontmatter-to-schema functionality
set -e

echo "=== Testing frontmatter-to-schema ==="
echo

# Run the basic example
echo "1. Testing basic example..."
cd examples/0.basic
./run.sh
if [ $? -eq 0 ]; then
    echo "✅ Basic example passed"
else
    echo "❌ Basic example failed"
    exit 1
fi
cd ../..

# Run the climpt example
echo
echo "2. Testing climpt registry example..."
deno run --allow-all cli.ts \
    examples/2.climpt/registry_schema.json \
    "examples/2.climpt/prompts/**/*.md" \
    examples/2.climpt/climpt-registry-output.json \
    --verbose

if [ $? -eq 0 ]; then
    echo "✅ Climpt example passed"
    # Output the generated JSON for the next step
    cat examples/2.climpt/climpt-registry-output.json
else
    echo "❌ Climpt example failed"
    exit 1
fi

echo
echo "=== All tests passed ==="