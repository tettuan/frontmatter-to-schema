# Implementation Plan - Type Safety & Totality Refactoring

## Phase 1: Core Type System Unification [HIGH PRIORITY]

### 1.1 Consolidate Result Types ✅ NEXT

- **Goal**: Single source of truth for Result types
- **Action**: Migrate all code to use `/src/domain/core/result.ts`
- **Strategy**:
  1. Update service interfaces to use DomainError types
  2. Deprecate ProcessingError, ValidationError, IOError from shared/types.ts
  3. Create migration wrapper functions for backward compatibility
  4. Update all imports across the codebase

### 1.2 Standardize Error Creation

- **Goal**: Consistent error creation patterns
- **Action**: Use `createDomainError()` everywhere, remove duplicate
  `createError()`
- **Files to update**:
  - All infrastructure adapters
  - Service implementations
  - Domain services

### 1.3 Fix Service Interface Error Types

- **Goal**: Remove `& { message: string }` intersection requirement
- **Action**: Update interfaces.ts to use proper DomainError unions
- **Strategy**: Incremental migration with compatibility wrappers

## Phase 2: Smart Constructors Implementation [MEDIUM PRIORITY]

### 2.1 Identify Value Objects for Smart Constructor Pattern

**Candidates**:

- `DocumentPath` - needs validation for .md/.markdown extension
- `DocumentContent` - needs null/empty validation
- `FrontMatterContent` - needs YAML parsing validation
- `SchemaDefinition` - needs JSON Schema validation
- `TemplateFormat` - needs format enum validation

### 2.2 Convert Current Value Objects

- **Pattern**:
  `private constructor + static create() returning Result<T, DomainError>`
- **Replace**: Direct constructor usage with factory methods
- **Add**: Comprehensive validation rules per business requirements

### 2.3 Update Entity Constructors

- **Goal**: Entities use validated value objects only
- **Action**: Update Document, FrontMatter, Schema, Template entities
- **Strategy**: Make constructors private, add static factory methods

## Phase 3: Eliminate Partial Functions [HIGH PRIORITY]

### 3.1 Convert Null-Returning Functions ✅ IMMEDIATE

**Identified Functions**:

- `FrontMatterExtractor.extract()` - returns `FrontMatter | null`
- `generic-pipeline.extractFrontMatter()` - returns `FrontMatterContent | null`
- `analysis-pipeline.processFile()` - returns `AnalysisResult | null`
- `frontmatter-models.extract()` - returns `FrontMatter | null`

**Conversion Strategy**:

- Replace `T | null` with `Result<T, DomainError>`
- Update all calling code to handle Result pattern
- Add proper error conditions for null cases

### 3.2 Remove Optional Properties Where Appropriate

**Current Optional Properties**:

- Various config interfaces have optional fields
- Consider if these should be discriminated unions instead

## Phase 4: Discriminated Unions [MEDIUM PRIORITY]

### 4.1 Entity State Modeling

**Document Entity States**:

- `{ kind: "WithFrontMatter"; frontMatter: FrontMatter; content: DocumentContent }`
- `{ kind: "WithoutFrontMatter"; content: DocumentContent }`

**Template Application States**:

- `{ kind: "Mapped"; result: MappedData }`
- `{ kind: "UnmappedMissing"; reason: MappingError }`
- `{ kind: "UnmappedInvalid"; reason: ValidationError }`

### 4.2 Processing Pipeline States

- Replace optional chaining with explicit state handling
- Add exhaustive switch statements with TypeScript's strictNullChecks

## Phase 5: Type Assertion Elimination [LOW PRIORITY]

### 5.1 Replace Type Assertions

**Current Issues**:

- Format casting: `format as "json" | "yaml"`
- Type narrowing: `type as "string" | "number"`

**Solutions**:

- Smart constructors for format validation
- Proper type guards for runtime type checking
- Union type refinement through discriminated unions

## Implementation Order

### Week 1: Foundation

1. ✅ **Fix core Result type consistency** (1-2 days)
   - Update service interfaces
   - Migrate error creation patterns
   - Fix import dependencies

2. **Convert critical partial functions** (2-3 days)
   - FrontMatterExtractor.extract()
   - Pipeline processing functions
   - Update all callers

### Week 2: Smart Constructors

3. **Implement Smart Constructors for core value objects** (2-3 days)
   - DocumentPath, DocumentContent, FrontMatterContent
   - Update entity constructors
   - Add comprehensive validation

4. **Entity refactoring** (2-3 days)
   - Document, FrontMatter, Schema entities
   - Private constructors + static factories
   - Remove direct instantiation

### Week 3: Advanced Patterns

5. **Discriminated unions for complex states** (2-3 days)
   - Document state modeling
   - Template application states
   - Processing pipeline states

6. **Type assertion cleanup** (1-2 days)
   - Replace type assertions with proper validation
   - Add type guards where needed
   - Improve type inference

## Success Metrics

### Compile-Time Safety

- [ ] Zero `any` types in domain code
- [ ] Zero type assertions in domain code
- [ ] All switch statements have no `default` case (exhaustiveness)
- [ ] No optional properties for state representation

### Runtime Safety

- [ ] All functions are total (no null/undefined returns)
- [ ] All errors are values (Result type)
- [ ] No thrown exceptions in domain code
- [ ] Comprehensive input validation

### Code Quality

- [ ] Consistent Result type usage across all domains
- [ ] Single error creation pattern
- [ ] Clear discriminated union patterns
- [ ] Self-documenting business rules through types

## Risk Mitigation

### Incremental Migration

- Keep old patterns working during transition
- Add compatibility wrappers where needed
- Migrate one domain at a time

### Testing Strategy

- Update tests to handle Result patterns
- Add tests for new error conditions
- Verify exhaustiveness with type checking
- Test invalid state prevention

### Rollback Plan

- Git feature branch with atomic commits
- Backward compatibility maintained until full migration
- Clear documentation of breaking changes
