#!/bin/bash

echo "Running tests..."
echo "================"

echo "Testing FrontMatter Extractor..."
deno test test/test-extractor.ts --allow-read

echo ""
echo "Testing Registry Builder..."
deno test test/test-registry-builder.ts

echo ""
echo "================"
echo "All tests completed!"