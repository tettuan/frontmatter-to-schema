# Refactoring Analysis - Issue #377

## Current State
- Total TypeScript files in src: 78
- CI Status: All tests passing (121 tests)
- Recent consolidations:
  - Merged mock-ai-analyzer and mock-schema-analyzer into mock-analyzer.ts
  - Removed duplicate Document model (models/document.ts)
  - Moved directories from domain subdirectories

## Target
- Reduce files from ~78 to ~60 (need to remove ~18 files)

## Identified Consolidation Opportunities

### 1. Claude Analyzers (Priority: HIGH)
- src/infrastructure/adapters/claude-analyzer.ts
- src/infrastructure/adapters/claude-schema-analyzer.ts
- Can be merged into single analyzer with method overloading (similar to mock-analyzer)

### 2. Domain Services with Overlapping Concerns
- Multiple extractor implementations
- Template processing spread across multiple files
- Schema-related services that could be unified

### 3. Redundant Interface Files
- src/domain/services/interfaces.ts
- src/domain/services/interfaces-improved.ts
- Should consolidate into single interface file

### 4. Domain Subdirectories to Flatten
- src/domain/shared/logging/ (only has logger.ts)
- Consider moving shared utilities to single level

### 5. Duplicate Registry/Aggregator Files
- src/application/services/RegistryAggregator.ts
- src/registry-aggregator.ts
- Appear to be duplicates

## Action Plan
1. Consolidate Claude analyzers (saves 1 file)
2. Merge interface files (saves 1 file)
3. Flatten logging directory (structural improvement)
4. Remove duplicate registry aggregator (saves 1 file)
5. Review and consolidate template-related files
6. Review and consolidate schema-related services
