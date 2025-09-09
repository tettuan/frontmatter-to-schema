# Design Principles and Architectural Governance

## Core Design Principles

### 1. Single Path Principle

**Definition**: For each domain concern, maintain exactly one canonical
implementation path.

**Rationale**: Multiple implementations create confusion, maintenance overhead,
and bypass opportunities.

**Application**:

- Document processing: Use `DocumentProcessor` exclusively
- Configuration loading: Use `ConfigurationOrchestrator` exclusively
- Template processing: Use `UnifiedTemplateMapperAdapter` exclusively

**Enforcement**: Any new processing path requires explicit architectural
approval and deprecation plan for existing paths.

### 2. Totality Through Consolidation

**Definition**: Apply Totality principle by ensuring complete error handling
within fewer, more comprehensive services rather than exhaustive service
coverage.

**Anti-Pattern**: Creating micro-services for every possible error condition
**Correct Pattern**: Comprehensive error handling within domain-appropriate
service boundaries

**Application**:

- ✅ `LoadSchemaUseCase` handles all schema loading errors comprehensively
- ❌ Separate services for `SchemaNotFoundError`, `SchemaParseError`,
  `SchemaValidationError`

### 3. AI Complexity Control Through Clarity

**Definition**: Reduce AI complexity by creating clear, well-documented
interfaces rather than excessive abstraction layers.

**Rationale**: The original problem was not service size but lack of clear
separation of concerns.

**Application**:

- Prefer clear, documented large services over fragmented micro-services
- Use comprehensive interfaces with clear contracts
- Maintain single responsibility at the business logic level, not implementation
  level

### 4. Test-Driven Architectural Decisions

**Definition**: All architectural decisions must include integration test
coverage demonstrating the complete flow.

**Requirements**:

- New processing paths require end-to-end test coverage
- Refactoring operations must maintain or improve test coverage
- Template processing must have integration tests proving functionality

### 5. Explicit Deprecation Protocol

**Definition**: Any refactoring that creates new implementations must include
explicit deprecation and removal timeline for old implementations.

**Process**:

1. Create new implementation
2. Add deprecation warnings to old implementation
3. Update all callers to use new implementation
4. Remove old implementation within same PR/release cycle
5. Verify no orphaned code remains

## Architectural Governance

### Service Creation Approval Process

#### Before Creating New Services

**Required Analysis**:

1. **Necessity Check**: Can existing services be extended instead?
2. **Duplication Scan**: Does similar functionality already exist?
3. **Integration Plan**: How will this integrate with canonical processing
   paths?
4. **Test Coverage**: What integration tests will prove this works end-to-end?

#### Approval Criteria

**New services are approved only if**:

- No existing service can reasonably be extended
- Clear business domain boundary justification exists
- Integration test plan is comprehensive
- Deprecation plan exists for any competing implementations

### Code Review Requirements

#### For All Changes

- [ ] Follows canonical processing paths
- [ ] Includes comprehensive error handling
- [ ] Maintains or improves test coverage
- [ ] No bypass patterns (raw data pushing, template skipping)

#### For New Services/Classes

- [ ] Architectural necessity documented
- [ ] Integration test coverage planned
- [ ] Clear interface contracts defined
- [ ] Deprecation impact assessed

#### For Refactoring Operations

- [ ] Deprecation timeline specified
- [ ] Migration path documented
- [ ] No orphaned implementations left
- [ ] Integration tests updated

### Monitoring and Enforcement

#### Regular Architectural Audits

**Monthly Reviews**:

- Service proliferation metrics
- Canonical path adherence measurement
- Deprecated code removal tracking
- Integration test coverage validation

#### Automated Checks

**CI Pipeline Requirements**:

- No direct frontmatter data pushing without template processing
- No new processing paths without corresponding tests
- Deprecation warning detection and removal timeline enforcement

#### Documentation Maintenance

**Quarterly Updates**:

- Canonical processing paths verification
- Design principle effectiveness assessment
- Governance process refinement
- Architectural decision record maintenance

## Domain-Driven Design Guidelines

### Bounded Context Definition

**Primary Contexts**:

1. **Document Processing**: Frontmatter extraction, validation, transformation
2. **Schema Management**: Schema loading, validation, reference resolution
3. **Template Processing**: Template compilation, rendering, transformation
4. **Configuration Management**: Configuration loading, validation,
   orchestration
5. **Result Management**: Output formatting, aggregation, persistence

### Service Boundaries

**Within Each Context**:

- One primary orchestrating service (e.g., `DocumentProcessor`)
- Supporting use cases for specific operations (e.g., `LoadSchemaUseCase`)
- Value objects for data modeling (e.g., `Schema`, `Template`)
- Repository interfaces for data access

**Cross-Context Communication**:

- Through well-defined interfaces only
- Using Result types for error propagation
- Via dependency injection, not direct instantiation

### Entity and Value Object Guidelines

**Entities**: Objects with identity that change over time

- `Document` (has path identity, content can change)
- `ProcessingSession` (has temporal identity, accumulates results)

**Value Objects**: Immutable objects defined by their attributes

- `Schema`, `Template`, `ConfigPath`, `DocumentPath`
- `FrontmatterData`, `AnalysisResult`

## Implementation Standards

### Result Type Usage

**All operations return Result<T, E>**:

```typescript
// ✅ Correct
async function loadSchema(path: ConfigPath): Promise<Result<Schema, DomainError>> {
  try {
    const data = await this.fileSystem.readFile(path.getValue());
    return { ok: true, data: Schema.create(data) };
  } catch (error) {
    return { ok: false, error: createDomainError(...) };
  }
}

// ❌ Incorrect  
async function loadSchema(path: string): Promise<Schema> {
  const data = await this.fileSystem.readFile(path); // Can throw
  return Schema.create(data); // Can throw
}
```

### Error Handling Standards

**Comprehensive Error Categories**:

- `FileNotFound`: Missing files or resources
- `ParseError`: Malformed data (JSON, YAML, etc.)
- `ValidationError`: Data doesn't meet business rules
- `ConfigurationError`: System misconfiguration
- `ProcessingError`: Runtime processing failures

**Error Propagation**:

- Use Result types for expected failures
- Use exceptions only for truly exceptional conditions
- Provide actionable error messages with context

### Testing Standards

**Test Categories Required**:

1. **Unit Tests**: Individual service behavior
2. **Integration Tests**: Cross-service workflows
3. **End-to-End Tests**: Complete CLI-to-output flows
4. **Architectural Tests**: Governance rule enforcement

**Coverage Requirements**:

- Minimum 80% line coverage maintained
- All canonical processing paths covered end-to-end
- All error conditions tested and documented

## Migration and Maintenance

### Legacy Code Management

**Deprecation Process**:

1. Add deprecation warnings to legacy implementations
2. Update documentation to point to canonical paths
3. Create migration timeline (max 2 weeks)
4. Remove deprecated code within timeline
5. Verify no references remain

### Refactoring Guidelines

**Before Refactoring**:

- Document current functionality completely
- Identify all current callers/dependencies
- Plan migration path for existing usage
- Design integration tests for new implementation

**During Refactoring**:

- Maintain backward compatibility during transition
- Update tests incrementally
- Keep deprecated implementations functional
- Document changes comprehensively

**After Refactoring**:

- Remove deprecated implementations completely
- Update all documentation
- Verify integration tests pass
- Confirm no orphaned code remains

---

**Authority**: This document establishes the architectural authority for the
frontmatter-to-schema project. All architectural decisions must align with these
principles or explicitly document and approve deviations.
