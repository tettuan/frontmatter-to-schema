#!/bin/bash

# Basic Usage Example
# Demonstrates simple frontmatter extraction and transformation

echo "=== Basic Frontmatter-to-Schema Example ==="
echo "Processing markdown files in docs/ directory..."

# Process the markdown files
../../frontmatter-to-schema \
  "./docs/**/*.md" \
  --schema="./schema.json" \
  --template="./template.json" \
  --output="./output.json"

# Check if successful
if [ $? -eq 0 ]; then
  echo "✅ Processing completed successfully!"
  echo "Output written to: output.json"

  # Display the output
  if [ -f "./output.json" ]; then
    echo ""
    echo "Generated output:"
    cat ./output.json
  fi
else
  echo "❌ Processing failed. Please check the error messages above."
  exit 1
fi