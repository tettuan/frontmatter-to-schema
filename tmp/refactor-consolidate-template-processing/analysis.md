# Template Processing Consolidation Analysis

## Current State

### Template-Related Components Found

1. **Domain Models**
   - `src/domain/models/template.ts` - Template and TemplateDefinition classes
   - Uses smart constructor pattern (already follows Totality)
   - Supports multiple formats: json, yaml, handlebars, custom

2. **Domain Services**
   - `src/domain/services/template-mapper.ts` - TemplateMapper class
   - `src/domain/services/ai-template-mapper.ts` - AITemplateMapper class
   - Two different approaches for template mapping

3. **Infrastructure Adapters**
   - `src/infrastructure/adapters/simple-template-mapper.ts` -
     SimpleTemplateMapper

## Issues Identified

### 1. Duplicate Template Processing Logic

- **TemplateMapper** (domain/services): Handles JSON, YAML, Handlebars formats
  internally
- **AITemplateMapper** (domain/services): Delegates to Claude AI
- **SimpleTemplateMapper** (infrastructure): Another implementation with
  different logic

### 2. Violations of DDD Principles

- Multiple template mapping implementations scattered across layers
- No clear bounded context for template processing
- Template application logic mixed between TypeScript and AI delegation

### 3. Totality Violations

- Optional return values without Result types in some methods
- `getValueByPath` returns `undefined` (partial function)
- `applyDataToTemplate` handles null/undefined without proper Result type
- Type assertions without validation (`as Record<string, unknown>`)

### 4. According to Domain Design Document

Per `docs/domain/domain-boundary.md`, we should have:

- **CD4: Template Management Domain** as a core domain
- Clear separation between template loading and application
- Event-driven communication between domains

## Refactoring Plan

### Phase 1: Consolidate Template Domain

1. Create unified `TemplateManagementDomain` following DDD boundaries
2. Define clear aggregate root: `TemplateRepository`
3. Establish single source of truth for template processing

### Phase 2: Apply Totality Principles

1. Convert all partial functions to total functions using Result type
2. Replace optional properties with discriminated unions
3. Add smart constructors for all value objects

### Phase 3: Unify Template Processing Strategy

1. Create single `TemplateProcessingStrategy` interface
2. Implement AI-based strategy (primary)
3. Implement fallback TypeScript strategy (secondary)
4. Use strategy pattern to select appropriate processor

### Phase 4: Event-Driven Integration

1. Implement domain events for template operations
2. Add event boundaries as specified in domain design
3. Ensure loose coupling between domains

## Files to Modify

### Core Domain Files

1. `src/domain/models/template.ts` - Enhance with more Totality patterns
2. `src/domain/services/template-mapper.ts` - Refactor to strategy pattern
3. `src/domain/services/ai-template-mapper.ts` - Consolidate with main mapper

### Infrastructure Files

1. `src/infrastructure/adapters/simple-template-mapper.ts` - Move logic to
   domain

### New Files to Create

1. `src/domain/template/aggregate.ts` - Template aggregate root
2. `src/domain/template/repository.ts` - Template repository interface
3. `src/domain/template/events.ts` - Domain events
4. `src/domain/template/strategies.ts` - Processing strategies

## Next Steps

1. Review existing test coverage for template processing
2. Create detailed refactoring tasks
3. Implement changes incrementally with tests
4. Validate against DDD and Totality principles
