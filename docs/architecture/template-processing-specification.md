# Template Processing System Specification

## 1. Overview

This specification defines the complete template processing system architecture
for transforming frontmatter data into formatted output using schema-driven
templates.

## 2. Main Processing Flow (Call Hierarchy)

### 2.1 Complete Call Chain

```
1. cli.ts (Main entry point)
    ↓
2. new CLI() - Creates CLI instance with all dependencies
    ↓
3. CLI.run(args) - Parses command line arguments
    ↓
4. CLI.executeCommand() - Internal method for command execution
    ↓
5. this.orchestrator.execute(config) - Delegates to PipelineOrchestrator
    ↓
6. PipelineOrchestrator.execute() - Main pipeline coordination
    ↓
7. OutputRenderingService.renderOutput() - Template rendering and output
```

### 2.2 Component Responsibilities in Call Chain

1. **cli.ts**: Entry point, handles Deno runtime initialization
2. **CLI class**: Command-line interface management, argument parsing,
   dependency injection
3. **PipelineOrchestrator**: Coordinates the entire processing pipeline:
   - Schema loading and validation
   - Document processing via FrontmatterTransformationService
   - Template path resolution
   - Data extraction for x-frontmatter-part
   - Delegation to OutputRenderingService
4. **OutputRenderingService**: Template rendering orchestration:
   - Template loading and parsing
   - Dual-template processing (main + items)
   - Variable resolution and {@items} expansion
   - Final output generation and file writing

## 3. Processing Flow Architecture

### 3.1 Data Processing Pipeline

```mermaid
graph TD
    A[Markdown Files] --> B[FrontmatterExtractor]
    B --> C[Individual FrontmatterData]

    C --> D[SchemaPathResolver]
    D --> E[Data Structuring via x-frontmatter-part]

    E --> F[FrontmatterTransformationService]
    F --> G[Aggregation via x-derived-from]

    G --> H[Final Data Structure]
    H --> I[TemplateRenderer]

    I --> J[Variable Resolution]
    J --> K[{@items} Expansion]
    K --> L[Final Output]

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#9f9,stroke:#333,stroke-width:2px
    style L fill:#99f,stroke:#333,stroke-width:2px
```

### 3.2 Data Structure Transformation

#### Stage 1: Individual Frontmatter

```json
{
  "c1": "meta",
  "c2": "resolve",
  "c3": "registered-commands",
  "title": "Resolve Registered Commands",
  "description": "Command description"
}
```

#### Stage 2: After x-frontmatter-part Aggregation

```json
{
  "tools": {
    "commands": [
      {
        "c1": "meta",
        "c2": "resolve",
        "c3": "registered-commands",
        "title": "Resolve Registered Commands",
        "description": "Command description"
      }
    ]
  }
}
```

#### Stage 3: After x-derived-from Processing

```json
{
  "version": "1.0.0",
  "description": "Climpt comprehensive configuration",
  "tools": {
    "availableConfigs": ["meta", "spec"],
    "allC1Categories": ["meta", "spec"],
    "allC2Actions": ["resolve", "analyze"],
    "allC3Targets": ["registered-commands", "quality-metrics"],
    "commands": [...]
  }
}
```

## 3. Data Partitioning Specification

### 3.1 Data Partitioning Concept

**Data Partitioning** is the mechanism that splits frontmatter data into
separate partitions for template processing. This concept is fully specified in
`mapping-hierarchy-rules.md` and is fundamental to understanding template
processing.

#### Key Principles

1. **Partition Creation**: `x-frontmatter-part: true` creates a data partition
   boundary
2. **Dual Template System**:
   - `x-template`: Receives full schema root data (Partition 1)
   - `x-template-items`: Receives array data from partition boundary
     (Partition 2)
3. **Template Independence**: Each template operates on its assigned partition
   independently
4. **No Scope Sharing**: Templates don't share data between partitions

#### Example

```json
// Schema with data partitioning
{
  "x-template": "container.json",           // Uses Partition 1 (full data)
  "metadata": { "version": "1.0" },
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,            // Creates partition boundary
    "x-template-items": "item.json",       // Uses Partition 2 (array only)
    "items": { "$ref": "cmd_schema.json" } // Schema validation only
  }
}

// Partition 1 Data (for x-template):
{
  "metadata": { "version": "1.0" },
  "commands": [...]  // Full array available
}

// Partition 2 Data (for x-template-items):
[
  { "id": "cmd1", "name": "..." },
  { "id": "cmd2", "name": "..." }
]
```

For complete details, see `mapping-hierarchy-rules.md`.

## 4. Variable Resolution Specification

### 4.1 Variable Notation

| Notation             | Description               | Resolution Method                      |
| -------------------- | ------------------------- | -------------------------------------- |
| `{variable}`         | Simple variable           | Top-level property access              |
| `{path.to.variable}` | Hierarchical variable     | Dot-notation traversal                 |
| `{array[].property}` | Array property extraction | Map operation on array elements        |
| `{@items}`           | Array item expansion      | Apply x-template-items to each element |

### 4.2 Variable Resolution Algorithm

```typescript
interface VariableResolver {
  /**
   * Resolves a variable path to its value in the data structure
   * @param path - Dot-notation path to the variable
   * @param data - Data object to resolve from
   * @returns Resolved value or undefined
   */
  resolve(path: string, data: any): any;
}
```

The resolver shall:

1. Split the path by dots to get segments
2. Traverse the data structure following segments
3. Handle array notation for collection processing
4. Return the resolved value or undefined if not found

## 5. {@items} Expansion Specification

### 5.1 Expansion Process Flow

```mermaid
graph LR
    A[Detect {@items}] --> B{x-template-items exists?}
    B -->|Yes| C[Load Item Template]
    B -->|No| H[Leave {@items} literal]
    C --> E[Apply to Each Item]
    E --> F[Combine Results]
    F --> G[Replace {@items}]
```

### 5.2 Implementation Requirements

1. **Template Resolution**
   - Retrieve `x-template-items` from schema
   - Load specified template file
   - Cache template for performance
   - If not present, mark `{@items}` for literal passthrough

2. **Data Array Identification**
   - Identify arrays marked with `x-frontmatter-part: true`
   - Extract corresponding data collection

3. **Item Processing**
   - Convert each array element to FrontmatterData
   - Apply item template to each element
   - Collect processed results

4. **Result Combination**
   - Combine processed items within the JSON template structure
   - Replace `{@items}` marker in the container template when an items template exists

5. **Fallback Handling**
   - Without `x-template-items`, leave `{@items}` unchanged in the rendered output

## 6. Domain Interaction Model

### 6.1 Schema Domain Responsibilities

- Store and provide template references (`x-template`, `x-template-items`)
- Resolve template paths to absolute locations
- Validate template reference integrity
- Provide schema extension metadata

### 6.2 Template Domain Responsibilities

#### Core Responsibilities

- Parse and render templates
- Detect and process variable placeholders
- Handle `{@items}` expansion
- Generate final output in specified format

#### OutputRenderingService

The `OutputRenderingService` is called by `PipelineOrchestrator` and serves as
the central orchestrator for template processing with the following specific
responsibilities:

**Dual-Template Processing**:

- Accepts two templates: main template (`x-template`) and items template
  (`x-template-items`)
- Accepts two data inputs: main data (FrontmatterData) and items data array
  (FrontmatterData[])
- Orchestrates the rendering process in two stages:
  1. Renders each item in the items array using the items template
  2. Combines rendered items and applies the main template to create final
     output

**Processing Flow**:

1. Load and validate both templates from file paths
2. If items template and data exist:
   - Render each item with items template
   - Combine rendered items inside the JSON template context
   - Merge combined items with main data
   - Apply main template to produce final output
3. If only main template exists:
   - Render the container template with available data
   - Leave any `{@items}` tokens untouched because no items template is defined
4. Write final rendered output to specified file path

**Key Features**:

- Variable replacement in templates with actual data values
- Template composition: combining items template results into main template
- Templates must be JSON format; output format controlled by x-template-format
  schema attribute
- Full error handling with Result types following Totality principles

### 6.3 Cross-Domain Coordination

```typescript
interface TemplateSchemaCoordinator {
  /**
   * Coordinates schema-driven template processing
   * @param schema - Schema with template references
   * @param data - Aggregated frontmatter data
   * @returns Processed output in specified format
   */
  process(schema: Schema, data: FrontmatterData[]): Result<ProcessedOutput>;
}
```

## 7. Data Access Patterns

### 7.1 Hierarchical Data Access

The system shall support deep property access using dot notation:

```typescript
interface DataAccessor {
  /**
   * Access data using dot-notation path
   * Examples:
   *   - "version" → data.version
   *   - "tools.commands" → data.tools.commands
   *   - "tools.commands[0].c1" → data.tools.commands[0].c1
   */
  get(path: string): Result<unknown>;
}
```

### 7.2 Array Processing Patterns

Support for array operations:

- Direct array access: `{commands}`
- Property extraction: `{commands[].c1}`
- Unique value collection: via `x-derived-unique: true`

## 8. Template Processing Rules

### 8.1 Core Principles

1. **Template Completeness**: Templates fully define output structure
2. **Explicit Output**: Only template content appears in output
3. **Variable Substitution**: Variables are replaced with actual values
4. **Array Expansion**: `{@items}` expands using item templates when available
5. **Format Separation**: Templates are authored in JSON; rendered output format is
   controlled separately by x-template-format (json|yaml|toml|markdown)

### 8.2 Template Format Specification

**Template Input Format**:

- All templates must be valid JSON format
- No YAML or other formats accepted for template files
- Templates define data structure and variable placeholders that are rendered as JSON

**Output Format Control**:

- `x-template-format` schema attribute controls final output format
- Supported formats: `"json"` | `"yaml"` | `"toml"` | `"markdown"`
- Default format: `"json"` if x-template-format not specified
- Rendered JSON is converted to the requested format after template evaluation

**Processing Flow**:

1. Parse JSON template (strict JSON validation)
2. Apply variable substitution and {@items} expansion when an items template exists
3. Convert the rendered JSON structure into the x-template-format output (json|yaml|toml|markdown)
4. Write formatted output to target file

### 8.3 Processing Order

1. Load and validate schema
2. Extract and aggregate frontmatter data
3. Apply x-derived-from rules
4. Load container template
5. Process variable substitutions
6. Handle `{@items}` expansions
7. Format output according to x-template-format schema attribute

## 9. Error Handling Strategy

### 9.1 Error Categories

| Category          | Description                          | Recovery Strategy             |
| ----------------- | ------------------------------------ | ----------------------------- |
| Schema Errors     | Invalid schema or missing references | Fail fast with clear message  |
| Template Errors   | Missing templates or syntax errors   | Provide fallback or fail      |
| Data Errors       | Missing required data                | Use defaults or skip item     |
| Resolution Errors | Unresolvable variables               | Keep placeholder or use empty |

### 9.2 Error Propagation

All errors shall be wrapped in Result types following Totality principles:

```typescript
type ProcessingResult<T> = Result<T, ProcessingError>;
```

## 10. Performance Considerations

### 10.1 Optimization Strategies

1. **Template Caching**: Cache parsed templates
2. **Lazy Evaluation**: Process only required data paths
3. **Batch Processing**: Process multiple files in parallel
4. **Memory Management**: Stream large datasets

### 10.2 Scalability Requirements

- Support processing of 1000+ markdown files
- Handle templates up to 1MB in size
- Process nested data structures up to 10 levels deep

## 11. Validation Requirements

### 11.1 Input Validation

- Schema must be valid JSON Schema Draft-07
- Templates must be valid JSON format only
- Output format specified by x-template-format schema attribute
  (json|yaml|toml|markdown)
- Frontmatter must be valid YAML

### 11.2 Output Validation

- Output must conform to template format
- All required variables must be resolved
- Array expansions must maintain data integrity

## 12. Success Criteria

### 12.1 Functional Requirements

1. **Variable Resolution**: All variable notations resolve correctly
2. **Array Expansion**: `{@items}` expands with proper templates
3. **Data Aggregation**: x-derived-from rules apply correctly
4. **Format Support**: JSON, TOML, YAML, and Markdown output formats work

### 12.2 Quality Requirements

- Test coverage ≥ 80%
- Zero hardcoding in implementation
- Complete error handling
- Full DDD/Totality compliance

## 13. Authority

This specification establishes the definitive architecture for the template
processing system. All implementations must conform to these requirements to
ensure consistent, reliable, and maintainable template processing functionality.
