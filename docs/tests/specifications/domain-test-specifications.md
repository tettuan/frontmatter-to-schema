# Domain Test Specifications

## Overview

This document defines test specifications for core domain models following DDD
principles and business requirements.

## 1. Schema Domain Tests

### Business Requirements

- Schema must have unique ID, definition, version, and optional description
- Schema validation must return Result type (Totality principle)
- Schema cannot exist without valid definition and version

### Test Specifications

#### Schema Creation

```typescript
describe("Schema Creation", () => {
  it("should create valid schema with all required fields");
  it("should return error for missing ID");
  it("should return error for invalid definition");
  it("should return error for invalid version");
  it("should handle optional description");
});
```

#### Schema Validation

```typescript
describe("Schema Validation", () => {
  it("should validate data matching schema structure");
  it("should return validation errors for mismatched types");
  it("should validate required fields");
  it("should allow optional fields");
  it("should return ValidatedData with metadata on success");
});
```

## 2. Command Processing Domain Tests

### Business Requirements

- Commands must have c1, c2, c3 components
- Commands must be analyzable with schema
- Registry builder aggregates commands into final registry

### Test Specifications

#### Command Creation

```typescript
describe("Command Creation", () => {
  it("should create command from valid frontmatter");
  it("should require all three components (c1, c2, c3)");
  it("should extract title and description");
  it("should handle optional fields");
});
```

#### Registry Building

```typescript
describe("Registry Building", () => {
  it("should aggregate commands into registry");
  it("should extract unique c1 values for availableConfigs");
  it("should validate registry against schema");
  it("should apply registry template");
});
```

## 3. Template Processing Domain Tests

### Business Requirements

- Templates define mapping rules and format
- Templates must handle array processing
- Templates must resolve property paths

### Test Specifications

#### Template Creation

```typescript
describe("Template Creation", () => {
  it("should create template with ID and format");
  it("should validate mapping rules");
  it("should initialize property path navigator");
});
```

#### Template Processing

```typescript
describe("Template Processing", () => {
  it("should map data using template rules");
  it("should handle nested property paths");
  it("should process array templates");
  it("should handle missing properties gracefully");
});
```

## 4. Document Processing Domain Tests

### Business Requirements

- Documents contain path, content, and optional frontmatter
- Documents must be transformable with schema and template
- Processing must follow two-stage pipeline

### Test Specifications

#### Document Creation

```typescript
describe("Document Creation", () => {
  it("should create document with path and content");
  it("should handle documents with frontmatter");
  it("should handle documents without frontmatter");
});
```

#### Document Transformation

```typescript
describe("Document Transformation", () => {
  it("should extract frontmatter from document");
  it("should validate against schema");
  it("should apply template mapping");
  it("should return transformation result");
});
```

## 5. Value Objects Tests

### Business Requirements

- Value objects must be immutable
- Value objects must validate on creation
- Value objects must follow smart constructor pattern

### Test Specifications

#### SchemaId Tests

```typescript
describe("SchemaId", () => {
  it("should create valid ID from non-empty string");
  it("should return error for empty string");
  it("should be immutable after creation");
  it("should provide value equality");
});
```

#### SchemaVersion Tests

```typescript
describe("SchemaVersion", () => {
  it("should create from valid semver string");
  it("should return error for invalid version format");
  it("should compare versions correctly");
  it("should be immutable");
});
```

## Test Coverage Matrix

| Domain             | Unit Tests | Integration Tests | E2E Tests | Coverage Target |
| ------------------ | ---------- | ----------------- | --------- | --------------- |
| Schema             | Required   | Required          | Optional  | 95%             |
| Command Processing | Required   | Required          | Required  | 90%             |
| Template           | Required   | Required          | Optional  | 85%             |
| Document           | Required   | Required          | Required  | 90%             |
| Value Objects      | Required   | Optional          | N/A       | 100%            |

## Test Data Requirements

### Fixtures

- Valid schema definitions
- Sample frontmatter data
- Template configurations
- Expected transformation results

### Mocks

- File system operations
- External service calls
- Database operations

## Quality Criteria

1. **Independence**: Each test must run in isolation
2. **Repeatability**: Tests must produce same results every run
3. **Speed**: Unit tests < 10ms, Integration < 100ms
4. **Clarity**: Test names describe business behavior
5. **Coverage**: Minimum 80% overall, 95% for core domains
