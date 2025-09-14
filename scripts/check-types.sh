#!/bin/bash

# Custom type checking script to avoid the glob file issue
echo "Running type check..."

# Find all TypeScript files and pass them to deno check
find . -name "*.ts" -type f \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -not -path "./tmp/*" \
  -not -path "./output/*" | \
  xargs deno check 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Type check passed"
  exit 0
else
  echo "❌ Type check failed"
  exit 1
fi