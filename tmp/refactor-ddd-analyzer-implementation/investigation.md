# Investigation: Current Analyzer Implementation

## Problem Summary (Bug #387)
- MockAnalyzer returns test data with basic structure
- Template expects registry structure (version, tools.availableConfigs, commands)
- Frontmatter only contains title and description fields
- No proper transformation logic exists

## Current Implementation Analysis

### MockAnalyzer (src/infrastructure/adapters/mock-analyzer.ts)
- Returns hardcoded test data
- Passes through frontmatter data with minimal processing
- Adds "_mock": true and "_processedAt" metadata
- Does not transform data to match template expectations

### Template Structure Expected
```json
{
  "version": "{version}",
  "description": "{description}",
  "tools": {
    "availableConfigs": "{tools.availableConfigs}",
    "commands": [...]
  }
}
```

### Actual Frontmatter Structure
```yaml
title: "Document title"
description: "Document description"
```

## Required Solution

### TypeScriptAnalyzer Requirements
1. Extract frontmatter data
2. Transform to match schema/template structure
3. Generate registry-compatible output
4. Follow DDD principles with:
   - Value objects for data validation
   - Smart constructors with Result types
   - Clear domain boundaries
   - Totality (no partial functions)

### Transformation Logic Needed
- Map frontmatter fields to registry structure
- Generate version from metadata or defaults
- Create tools.availableConfigs from document analysis
- Build commands array from document content

## Files to Modify
1. Create: src/domain/analyzers/typescript-analyzer.ts
2. Create: src/domain/analyzers/value-objects.ts
3. Update: cli.ts (use new analyzer)
4. Update: src/application/use-cases/process-documents.ts
5. Create tests: tests/unit/domain/analyzers/typescript-analyzer.test.ts

## Domain Design

### Bounded Context: Analysis Domain
- Responsibility: Transform frontmatter to structured data
- Input: FrontMatter + Schema + Template
- Output: Structured data matching template
- Lifecycle: Short (request-scoped)

### Value Objects
- AnalysisResult
- RegistryVersion
- ToolConfiguration
- Command

### Aggregate Root
- TypeScriptAnalyzer

### Events
- AnalysisStarted
- AnalysisCompleted
- AnalysisFailed