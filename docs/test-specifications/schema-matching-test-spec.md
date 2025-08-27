# Schema Matching Architecture Test Specifications

## Overview

Test specifications for TypeScript-based schema matching and template
transformation processing.

## Test Categories

### 1. Extraction Phase Tests

#### 1.1 FrontMatter Extraction Unit Tests

**Target Function**: `extractFrontMatter(text: string): FrontMatterData`

**Test Cases**:

- TC1.1.1: Extract valid YAML frontmatter from markdown
  - Input: Markdown with valid YAML frontmatter
  - Expected: Parsed YAML object
  - Completion: All test cases pass

- TC1.1.2: Handle missing frontmatter
  - Input: Markdown without frontmatter
  - Expected: Empty object or null
  - Completion: Proper error handling verified

- TC1.1.3: Handle malformed YAML
  - Input: Invalid YAML syntax in frontmatter
  - Expected: Error with descriptive message
  - Completion: Error handling implemented

- TC1.1.4: Extract only from beginning of file
  - Input: Frontmatter-like content in body
  - Expected: Only initial frontmatter extracted
  - Completion: Boundary detection works correctly

#### 1.2 Template Variable Extraction Unit Tests

**Target Function**: `extractTemplateVariables(template: string): SchemaPath[]`

**Test Cases**:

- TC1.2.1: Extract simple object paths
  - Input: Template with `{tools.name}`
  - Expected: Array containing `["tools.name"]`
  - Completion: Simple paths extracted correctly

- TC1.2.2: Extract array notation paths
  - Input: Template with `{tools.commands[].options.input}`
  - Expected: Array with complex path preserved
  - Completion: Array notation handled properly

- TC1.2.3: Extract indexed array paths
  - Input: Template with `{tools.availableConfigs[0]}`
  - Expected: Array with indexed path
  - Completion: Index notation preserved

- TC1.2.4: Handle multiple variables
  - Input: Template with multiple `{...}` patterns
  - Expected: All unique paths extracted
  - Completion: All variables identified

### 2. Schema Mapping Phase Tests

#### 2.1 Schema Expansion Unit Tests

**Target Function**: `expandSchema(schema: JSONSchema): SchemaPathInfo[]`

**Test Cases**:

- TC2.1.1: Expand simple object schema
  - Input: Basic object schema
  - Expected: Flattened path-type pairs
  - Completion: All properties expanded

- TC2.1.2: Expand nested object schema
  - Input: Deeply nested schema
  - Expected: All nested paths with correct hierarchy
  - Completion: Recursion works correctly

- TC2.1.3: Expand array type schema
  - Input: Schema with array properties
  - Expected: Array notation in paths
  - Completion: Array types handled

- TC2.1.4: Include type and required info
  - Input: Schema with various types and required fields
  - Expected: Complete metadata for each path
  - Completion: All metadata preserved

#### 2.2 FrontMatter-Schema Mapping Unit Tests

**Target Function**:
`mapFrontMatterToSchema(frontMatter: any, schemaInfo: SchemaPathInfo[]): MappingResult`

**Test Cases**:

- TC2.2.1: Exact key matching
  - Input: FrontMatter keys matching schema exactly
  - Expected: Direct mapping created
  - Completion: Exact matches work

- TC2.2.2: Fuzzy key matching
  - Input: Similar but not exact key names
  - Expected: Best match based on similarity score
  - Completion: Similarity algorithm works

- TC2.2.3: Type validation
  - Input: Values with mismatched types
  - Expected: Type mismatches rejected
  - Completion: Type checking enforced

- TC2.2.4: Required field validation
  - Input: Missing required fields
  - Expected: Warnings for missing required fields
  - Completion: Validation messages generated

- TC2.2.5: Parent hierarchy matching
  - Input: Keys with same name in different hierarchies
  - Expected: Correct hierarchy preserved
  - Completion: Context-aware matching

### 3. Template Rendering Phase Tests

#### 3.1 Variable Replacement Unit Tests

**Target Function**:
`replaceTemplateVariables(template: string, mappedData: MappingResult): string`

**Test Cases**:

- TC3.1.1: Simple value replacement
  - Input: Template with simple paths
  - Expected: Values substituted correctly
  - Completion: Basic replacement works

- TC3.1.2: Missing value handling
  - Input: Template with undefined paths
  - Expected: Configurable behavior (empty/error)
  - Completion: Missing values handled

- TC3.1.3: Array value rendering
  - Input: Template with array paths
  - Expected: Array formatted appropriately
  - Completion: Arrays rendered correctly

- TC3.1.4: Nested object rendering
  - Input: Template with complex objects
  - Expected: JSON or formatted output
  - Completion: Objects rendered properly

#### 3.2 Array/Object Processing Unit Tests

**Target Function**: `processComplexTypes(value: any, format: string): string`

**Test Cases**:

- TC3.2.1: Array to JSON format
  - Input: Array value with JSON format
  - Expected: Valid JSON string
  - Completion: JSON formatting works

- TC3.2.2: Array to CSV format
  - Input: Array value with CSV format
  - Expected: Comma-separated values
  - Completion: CSV formatting works

- TC3.2.3: Object expansion
  - Input: Object value for template
  - Expected: Formatted object representation
  - Completion: Object formatting works

### 4. Integration Tests

#### 4.1 End-to-End Processing Tests

**Target Function**:
`processSchemaMatching(input: string, schema: JSONSchema, template: string): ProcessResult`

**Test Cases**:

- TC4.1.1: Complete valid flow
  - Input: Valid frontmatter, schema, and template
  - Expected: Fully rendered output
  - Completion: E2E flow works

- TC4.1.2: Error propagation
  - Input: Various error conditions
  - Expected: Appropriate error messages
  - Completion: Errors handled gracefully

- TC4.1.3: Performance with large schemas
  - Input: Complex nested schemas
  - Expected: Reasonable performance
  - Completion: Performance benchmarks met

## Completion Criteria

### Per Unit Function

- [ ] All test cases implemented
- [ ] Code coverage >= 90%
- [ ] All edge cases handled
- [ ] Performance benchmarks met
- [ ] Documentation complete

### Overall Project

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Type safety verified
- [ ] Error handling comprehensive
- [ ] Schema validation working
- [ ] Template rendering accurate

## Test Implementation Priority

1. **High Priority**: Core extraction and mapping functions
2. **Medium Priority**: Validation and error handling
3. **Low Priority**: Format variations and optimizations

## Dependencies

- Testing Framework: Deno Test
- Assertion Library: Deno std/assert
- Mock Data: Test fixtures in `/test/fixtures`

## Notes

- Follow TDD approach
- Implement tests before functions
- Maintain test independence
- Use descriptive test names
- Document edge cases
