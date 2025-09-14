#!/bin/sh
# 全レベル処理
for level in req spec design impl test; do
    deno run --allow-all mod.ts \
        --schema ".agent/spec-trace/index_${level}_schema.json" \
        --template ".agent/spec-trace/level_index_template.json" \
        --input ".agent/spec-trace/docs" \
        --output ".agent/spec-trace/index/${level}_index.json"
        --verbose
done