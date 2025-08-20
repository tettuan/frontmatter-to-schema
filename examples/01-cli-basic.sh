#!/bin/bash

# Example 1: Basic CLI Usage
# 
# This example demonstrates the basic usage of the frontmatter-to-schema CLI
# for processing markdown files with frontmatter.

echo "📚 Frontmatter to Schema - Basic CLI Example"
echo "=========================================="
echo ""

# Example 1: Using configuration file
echo "1️⃣ Processing with configuration file:"
echo "$ frontmatter-to-schema examples/climpt-registry --schema=examples/climpt-registry/schema.json --template=examples/climpt-registry/template.json --destination=examples/output"
echo ""

frontmatter-to-schema examples/climpt-registry \
  --schema=examples/climpt-registry/schema.json \
  --template=examples/climpt-registry/template.json \
  --destination=examples/output

echo ""
echo "✅ Output saved to: examples/output/registry.json"
echo ""

# Example 2: Processing articles with YAML template
echo "2️⃣ Processing articles with YAML template:"
echo "$ frontmatter-to-schema examples/sample-docs --schema=examples/articles-index/schema.json --template=examples/articles-index/template.yaml --destination=examples/output"
echo ""

frontmatter-to-schema examples/sample-docs \
  --schema=examples/articles-index/schema.json \
  --template=examples/articles-index/template.yaml \
  --destination=examples/output

echo ""
echo "✅ Output saved to: examples/output/articles-index.yaml"
echo ""

# Example 3: Show help
echo "3️⃣ Viewing help information:"
echo "$ frontmatter-to-schema --help"
echo ""

frontmatter-to-schema --help

echo ""
echo "🎉 Examples completed successfully!"