# Refactoring Analysis: Console.log Cleanup & Factory Consolidation

## Current State Analysis

### Console.log Occurrences
Found 4 direct console.log statements:
1. `src/domain/models/value-objects.ts:28` - In a comment (can be ignored)
2. `src/application/cli.ts:208` - Direct console.log for help text
3. `src/domain/shared/logging/logger.ts:3` - In a comment (can be ignored) 
4. `src/main.ts:210` - Direct console.log for help text

### Factory Pattern Occurrences
Found multiple factory classes that need consolidation:

#### Deprecated Factories (marked with @deprecated)
1. `AnalysisEngineFactory` - src/domain/core/analysis-engine.ts
2. `SchemaAnalysisFactory` - src/domain/analysis/schema-driven.ts
3. `PlaceholderProcessorFactory` - src/domain/template/placeholder-processor.ts
4. `TemplateFormatHandlerFactory` - src/domain/template/format-handlers.ts
5. `DynamicPipelineFactory` - src/domain/core/schema-management.ts
6. `FrontMatterPipelineFactory` - src/domain/pipeline/generic-pipeline.ts
7. `ClimptPipelineFactory` - src/application/climpt/climpt-adapter.ts

#### Current Unified Factory System
- `MasterComponentFactory` - Main factory registry
- `FactoryConfigurationBuilder` - Builder for factory configuration
- `AnalysisDomainFactory` - Analysis domain factory
- `TemplateDomainFactory` - Template domain factory  
- `PipelineDomainFactory` - Pipeline domain factory

### LoggerFactory Usage
Already extensively used throughout the codebase (60+ instances), which is good.

## Refactoring Tasks

### Task 1: Replace Direct console.log Statements
1. ✅ `src/application/cli.ts:208` - Replace with LoggerFactory
2. ✅ `src/main.ts:210` - Replace with LoggerFactory

### Task 2: Consolidate Deprecated Factories
Need to update all references from deprecated factories to unified factory system:

1. **AnalysisEngineFactory references**:
   - tests/unit/domain/core/analysis-engine.test.ts (6 occurrences)
   - tests/integration/analysis-pipeline.test.ts (1 occurrence)

2. **SchemaAnalysisFactory references**:
   - src/application/climpt/climpt-adapter.ts (2 occurrences in ClimptPipelineFactory)

3. **TemplateFormatHandlerFactory references**:
   - src/infrastructure/template/file-template-repository.ts (1 occurrence)
   - src/domain/template/strategies.ts (2 occurrences)

4. **PlaceholderProcessorFactory references**:
   - Used in TemplateDomainFactory (already migrated)

5. **DynamicPipelineFactory references**:
   - Used in PipelineDomainFactory (already integrated)

## Implementation Order

1. **Phase 1: Console.log Cleanup** (Quick wins)
   - Replace 2 direct console.log statements with LoggerFactory

2. **Phase 2: Update Test Files**
   - Migrate test files to use unified factory system
   - Remove dependencies on deprecated factories

3. **Phase 3: Update Production Code**
   - Update template strategies to use unified factory
   - Update file-template-repository to use unified factory
   - Update climpt-adapter to use unified factory

4. **Phase 4: Remove Deprecated Code**
   - Remove all deprecated factory classes
   - Clean up unused imports

## Domain Boundaries
According to DDD principles:
- Factories belong to their respective domains
- Unified factory system respects domain boundaries
- Logger is shared infrastructure (cross-cutting concern)