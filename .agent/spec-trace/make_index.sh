# 全レベル処理                                                                                                       [fix/post-integration-adjustments]:+
for level in req spec design impl test; do
    ./frontmatter-to-schema \
        ".agent/spec-trace/level_${level}_schema.json" \
        ".agent/spec-trace/index/${level}_index.json" \
        ".agent/spec-trace/docs/**/*.md" \
        --verbose
done