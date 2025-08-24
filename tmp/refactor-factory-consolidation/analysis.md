# Factory Pattern Consolidation Analysis

## Current State

### Deprecated Factory: AnalysisEngineFactory
- **Location**: `src/domain/core/analysis-engine.ts`
- **Status**: Marked as @deprecated
- **Recommendation**: Use AnalysisDomainFactory from component-factory.ts

### Usage Locations
1. **component-factory.ts (line 83)**
   - Used inside AnalysisDomainFactory.createComponents()
   - Calls: `AnalysisEngineFactory.createDefault()`

2. **tests/integration/analysis-pipeline.test.ts**
   - Import and usage: `const { processor } = AnalysisEngineFactory.createDefault();`

3. **tests/unit/domain/core/analysis-engine.test.ts**
   - Two usages in test cases
   - Both call `AnalysisEngineFactory.createDefault()`

## Refactoring Plan

### Step 1: Move AnalysisEngineFactory logic into AnalysisDomainFactory
The deprecated factory creates:
- `GenericAnalysisEngine`
- `RobustSchemaAnalyzer`
- `RobustTemplateMapper`
- `ContextualAnalysisProcessor`

These should be created directly in AnalysisDomainFactory.

### Step 2: Update References
1. Remove the factory call from AnalysisDomainFactory
2. Update test files to use AnalysisDomainFactory or create components directly

### Step 3: Remove AnalysisEngineFactory
Once all references are updated, remove the deprecated factory class.

## Entropy Reduction Metrics

### Before
- Factory Classes: 6
  - MasterComponentFactory
  - AnalysisDomainFactory
  - TemplateDomainFactory  
  - PipelineDomainFactory
  - AnalysisEngineFactory (deprecated)
  - + Multiple specialized factories

### After
- Factory Classes: 4 (main domain factories)
- Removed redundancy
- Clear domain boundaries
- Single responsibility per factory

## Type Safety Improvements (Totality)

### Current Issues
- AnalysisEngineFactory returns loosely typed object
- No Result<T,E> pattern in factory creation
- Missing validation in factory methods

### Improvements
- Add Result<T,E> pattern to factory methods
- Validate dependencies before component creation
- Use discriminated unions for factory configuration
- Implement Smart Constructors for factory components