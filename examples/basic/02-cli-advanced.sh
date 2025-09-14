#!/bin/bash

# Example 2: Advanced CLI Usage
# 
# This example demonstrates advanced usage patterns including:
# - Processing multiple directories
# - Custom output formats
# - Error handling

echo "🚀 Frontmatter to Schema - Advanced CLI Example"
echo "==========================================="
echo ""

# Example 1: Process with custom output format (JSON)
echo "1️⃣ Processing with JSON output format:"
echo "$ frontmatter-to-schema .agent/climpt/prompts --schema=examples/climpt-registry/schema.json --template=examples/climpt-registry/template.json --destination=examples/output/advanced"
echo ""

# Create output directory if it doesn't exist
mkdir -p examples/output/advanced

frontmatter-to-schema .agent/climpt/prompts \
  --schema=examples/climpt-registry/schema.json \
  --template=examples/climpt-registry/template.json \
  --destination=examples/output/advanced

if [ $? -eq 0 ]; then
  echo "✅ Successfully processed prompts directory"
else
  echo "❌ Error processing prompts directory"
fi
echo ""

# Example 2: Process alternative command structure
echo "2️⃣ Processing alternative command structure:"
echo "$ frontmatter-to-schema examples/alternative-structure/commands --schema=examples/climpt-registry/schema.json --template=examples/climpt-registry/template.json --destination=examples/output/alternative"
echo ""

mkdir -p examples/output/alternative

frontmatter-to-schema examples/alternative-structure/commands \
  --schema=examples/climpt-registry/schema.json \
  --template=examples/climpt-registry/template.json \
  --destination=examples/output/alternative

if [ $? -eq 0 ]; then
  echo "✅ Successfully processed alternative structure"
else
  echo "❌ Error processing alternative structure"
fi
echo ""

# Example 3: Batch processing with error handling
echo "3️⃣ Batch processing multiple directories:"
echo ""

DIRS=(
  "examples/sample-docs"
  "examples/alternative-structure/commands"
  ".agent/climpt/prompts"
)

for dir in "${DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Processing: $dir"
    output_name=$(basename "$dir")
    
    frontmatter-to-schema "$dir" \
      --schema=examples/climpt-registry/schema.json \
      --template=examples/climpt-registry/template.json \
      --destination="examples/output/batch-$output_name" 2>/dev/null
    
    if [ $? -eq 0 ]; then
      echo "  ✅ Success: examples/output/batch-$output_name/registry.json"
    else
      echo "  ⚠️  Skipped: No markdown files or invalid frontmatter"
    fi
  else
    echo "  ❌ Directory not found: $dir"
  fi
  echo ""
done

echo "🎉 Advanced examples completed!"
echo ""
echo "📁 Check the output directory for generated files:"
ls -la examples/output/*.json examples/output/*/*.json 2>/dev/null | tail -5