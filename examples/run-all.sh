#!/bin/bash

# Run all examples script
# Usage: ./examples/run-all.sh

echo "🚀 Running All Examples"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Run each example
examples=(
  "01-build-registry.ts"
  "02-parse-frontmatter.ts"
  "03-create-registry.ts"
  "04-complete-flow.ts"
)

for example in "${examples[@]}"; do
  echo "Running: $example"
  echo "--------------------------------------"
  
  if deno run --allow-read --allow-write "examples/$example" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ $example completed successfully${NC}"
  else
    echo -e "${RED}✗ $example failed${NC}"
  fi
  
  echo ""
done

echo "======================================"
echo "📊 Output files created:"
echo ""

if [ -d "examples/output" ]; then
  ls -la examples/output/
else
  echo "No output directory found"
fi

echo ""
echo "✨ All examples completed!"