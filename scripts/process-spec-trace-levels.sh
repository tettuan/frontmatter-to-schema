#!/bin/bash
# 全レベル処理 - Process all spec-trace levels
cd .agent/spec-trace
for level in req spec design impl test; do
    ../../frontmatter-to-schema \
        "index_${level}_schema.json" \
        "index/${level}_index.json" \
        "docs/**/*.md" \
        --verbose
done
cd ../..