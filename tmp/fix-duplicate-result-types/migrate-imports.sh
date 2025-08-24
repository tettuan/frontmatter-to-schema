#!/bin/bash

# Script to migrate all Result imports from shared/result.ts to core/result.ts

echo "🔄 Starting Result type import migration..."

# Files to update (infrastructure layer)
infrastructure_files=(
    "src/application/climpt/climpt-adapter.ts"
    "src/application/configuration.ts"
    "src/infrastructure/template/file-template-repository.ts"
    "src/infrastructure/adapters/claude-analyzer.ts"
    "src/infrastructure/adapters/mock-ai-analyzer.ts"
    "src/infrastructure/ports/file-system.ts"
    "src/infrastructure/ports/ai-analyzer.ts"
)

# Files in domain layer that need path updates
domain_files=(
    "src/domain/core/ai-analysis-orchestrator.ts"
    "src/domain/template/repository.ts"
    "src/domain/template/migration-adapter.ts"
    "src/domain/template/strategies.ts"
    "src/domain/template/placeholder-processor.ts"
    "src/domain/template/format-handlers.ts"
    "src/domain/template/service.ts"
    "src/domain/template/aggregate.ts"
    "src/domain/shared/json-util.ts"
    "src/domain/models/schema.ts"
    "src/domain/models/template.ts"
    "src/domain/models/document.ts"
    "src/domain/models/transformation.ts"
    "src/domain/services/schema-validator.ts"
    "src/domain/services/template-mapper.ts"
    "src/domain/services/frontmatter-extractor.ts"
    "src/domain/services/ai-template-mapper.ts"
)

# Update infrastructure files (need to go deeper: ../shared -> ../../domain/core)  
for file in "${infrastructure_files[@]}"; do
    if [ -f "$file" ]; then
        echo "📝 Updating $file"
        sed -i '' 's|from.*"\.\.\/domain\/shared\/result\.ts"|from "../../domain/core/result.ts"|g' "$file"
        sed -i '' 's|from.*"\.\./\.\./domain\/shared\/result\.ts"|from "../../domain/core/result.ts"|g' "$file"
    else
        echo "⚠️  File not found: $file"
    fi
done

# Update domain files (shared -> core)
for file in "${domain_files[@]}"; do
    if [ -f "$file" ]; then
        echo "📝 Updating $file"
        sed -i '' 's|from.*"\.\.\/shared\/result\.ts"|from "../core/result.ts"|g' "$file"
        sed -i '' 's|from.*"\.\/result\.ts"|from "../core/result.ts"|g' "$file"
    else
        echo "⚠️  File not found: $file"
    fi
done

echo "✅ Import migration completed"
echo "📋 Files updated: $(( ${#infrastructure_files[@]} + ${#domain_files[@]} ))"