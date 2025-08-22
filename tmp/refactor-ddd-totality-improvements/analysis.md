# Current Codebase Analysis - Totality & DDD Violations

## 1. Totality Violations Found

### 1.1 Optional Properties (Should use Discriminated Unions)
- **Location**: Various entity and value object classes
- **Issue**: Using optional properties instead of discriminated unions
- **Example**: Configuration objects with optional fields

### 1.2 Type Assertions and Unsafe Casts
- **Location**: 
  - `simple-template-mapper.ts`: Line 33-36, 41-44 - `as Record<string, unknown>`
  - Various places using type assertions
- **Issue**: Forcing types instead of proper type safety

### 1.3 Missing Smart Constructors
- **Location**: Value objects in `src/domain/models/value-objects.ts`
- **Current**: Direct constructor access
- **Should be**: Private constructor + static create method with Result type

### 1.4 Exception-based Control Flow
- **Location**: Various service implementations
- **Issue**: Using try-catch instead of Result types consistently

## 2. Domain Boundary Violations

### 2.1 Schema Dependency Issues
- **Current**: Schema is embedded in core domain
- **Should be**: Schema should be injected at runtime
- **Violation**: Core domain knows about specific schema structures

### 2.2 Missing Dependency Injection
- **Location**: Application layer directly instantiating infrastructure
- **Issue**: Tight coupling between layers

### 2.3 Infrastructure Leaking into Domain
- **Location**: Domain entities directly using Deno APIs
- **Issue**: Domain should be platform-agnostic

## 3. Specific Files to Refactor

### Priority 1 - Value Objects (Apply Smart Constructors)
1. `src/domain/models/value-objects.ts`
   - DocumentPath
   - ConfigPath
   - OutputPath
   - SchemaDefinition
   - MappingRule
   - TemplateFormat

### Priority 2 - Entities (Apply Discriminated Unions)
1. `src/domain/models/entities.ts`
   - Schema
   - Template
   - Document
   - AnalysisResult

### Priority 3 - Infrastructure (Apply Result Types)
1. `src/infrastructure/adapters/configuration-loader.ts`
2. `src/infrastructure/adapters/simple-template-mapper.ts`
3. `src/infrastructure/adapters/claude-schema-analyzer.ts`
4. `src/infrastructure/adapters/mock-schema-analyzer.ts`

### Priority 4 - Application Layer
1. `src/application/use-cases/process-documents.ts`

## 4. Refactoring Strategy

### Phase 1: Foundation (Value Objects)
- Implement Smart Constructors for all value objects
- Replace direct instantiation with factory methods
- Add proper validation with Result types

### Phase 2: Domain Model
- Convert entities to use discriminated unions
- Remove optional properties
- Implement proper state transitions

### Phase 3: Infrastructure
- Remove type assertions
- Implement proper error handling with Result types
- Add dependency injection boundaries

### Phase 4: Application Layer
- Refactor use cases to use Result types throughout
- Remove exception-based control flow
- Add exhaustive pattern matching

## 5. Metrics to Track

### Before Refactoring
- Type assertions: 10+
- Optional properties: 20+
- Try-catch blocks: 15+
- Direct instantiations: 30+

### After Refactoring Goals
- Type assertions: 0
- Optional properties: 0 (replaced with unions)
- Try-catch blocks: < 5 (only at boundaries)
- Direct instantiations: 0 (use DI)

## 6. Risk Assessment

### High Risk Areas
- Template processing logic (complex placeholders)
- Schema validation (dynamic structure)
- File I/O operations (external dependencies)

### Mitigation Strategy
- Incremental refactoring with tests
- Keep old implementation alongside new
- Gradual migration with feature flags