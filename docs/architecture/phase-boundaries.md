# Phase Boundaries and Processing Flow

This document defines the clear boundaries between the three processing phases
and maps current implementation to these phases.

## Overview

The frontmatter-to-schema system processes documents through three distinct
phases, each with clear responsibilities and boundaries:

1. **Phase 1: Individual File Processing** - Per-file frontmatter extraction and
   directive application
2. **Phase 2: File Aggregation** - Cross-file data collection and integration
3. **Phase 3: Template Expansion** - Final output generation with templates

## Phase 1: Individual File Processing

### Purpose

Process each Markdown file independently, extracting frontmatter and applying
per-file directives.

### Scope

- Single file input → Single file output (intermediate)
- No cross-file dependencies
- Preserves document-level data structure

### Directives Processed

Stage 1-5 directives (per schema-directives-specification.md):

- Stage 1: `x-frontmatter-part` - Identify target array
- Stage 2: `x-flatten-arrays` - Flatten specified property (optional)
- Stage 3: `x-jmespath-filter` - Apply filtering
- Stage 4: `x-derived-from` - Collect values from paths
- Stage 5: `x-derived-unique` - Remove duplicates

### Implementation Mapping

**Primary Components:**

```
src/domain/document/
├── services/
│   ├── frontmatter-parser.ts         # Extract frontmatter from markdown
│   ├── document-loader-service.ts    # Load and parse documents
│   └── markdown-processor.ts         # Process markdown content
```

**Key Operations:**

1. Read markdown file (`DocumentLoaderService`)
2. Extract frontmatter (`FrontmatterParser`)
3. Apply Stage 1-5 directives (per-file scope)
4. Preserve structure (default) or flatten arrays (if `x-flatten-arrays`)

### Data Flow

```
Markdown File → FrontmatterParser → Schema Validation → Directive Application → Intermediate Result
```

### Phase 1 Output

Intermediate data structure preserving:

- Original frontmatter structure (unless flattened)
- Applied per-file directives
- Individual document metadata

## Phase 2: File Aggregation

### Purpose

Collect and integrate results from all files, preparing unified dataset for
template expansion.

### Scope

- Multiple file inputs → Single aggregated output
- Cross-file data collection
- Array consolidation for `{@items}`

### Directives Processed

Stage 6: Data Collection (internal processing)

- Aggregate `x-frontmatter-part` arrays from all files
- Consolidate derived values across documents
- Prepare `{@items}` array

### Implementation Mapping

**Primary Components:**

```
src/domain/aggregation/
├── entities/
│   └── aggregation.ts                 # Aggregation entity
├── services/
│   └── aggregation-service.ts         # Cross-file aggregation logic
└── strategies/
    ├── array-aggregation-strategy.ts  # Array consolidation
    └── merge-aggregation-strategy.ts  # Object merging
```

**Application Layer:**

```
src/application/services/
└── pipeline-orchestrator.ts           # Orchestrates Phase 1→2→3 flow
```

### Key Operations

1. Collect Phase 1 results from all files (`AggregationService`)
2. Merge `x-frontmatter-part` arrays
3. Consolidate derived values (cross-file `x-derived-from`)
4. Build unified dataset with `{@items}` array

### Data Flow

```
Multiple Phase 1 Results → AggregationService → ArrayAggregationStrategy → Unified Dataset
```

### Phase 2 Output

Unified data structure containing:

- `{@items}` array (all x-frontmatter-part arrays merged)
- Cross-file derived properties
- Aggregated metadata

## Phase 3: Template Expansion

### Purpose

Apply templates to generate final output in desired format (JSON/YAML/etc).

### Scope

- Unified dataset → Final formatted output
- Template variable substitution
- Output format conversion

### Directives Processed

Stage 7: Template Application

- `x-template` - Container template for overall structure
- `x-template-items` - Item template for `{@items}` expansion
- `x-template-format` - Output format specification

### Implementation Mapping

**Primary Components:**

```
src/domain/template/
├── entities/
│   └── template.ts                    # Template entity
├── services/
│   └── template-renderer.ts           # Render templates with data
└── value-objects/
    └── template-path.ts               # Template file references

src/domain/schema/services/
└── schema-template-resolver.ts        # Extract x-template directives

src/application/services/
└── template-schema-coordinator.ts     # Coordinate template+schema processing
```

**Output Layer:**

```
src/infrastructure/output/
├── json-formatter.ts                  # JSON output
└── yaml-formatter.ts                  # YAML output
```

### Key Operations

1. Load container template (`x-template`)
2. Load item template (`x-template-items`)
3. Expand `{@items}` with item template (`TemplateRenderer`)
4. Apply container template for final structure
5. Format output per `x-template-format`

### Data Flow

```
Unified Dataset → SchemaTemplateResolver → TemplateRenderer → FormatStrategy → Final Output File
```

### Phase 3 Output

Formatted file in specified format:

- JSON, YAML, TOML, or Markdown
- Complete template expansion
- Ready for consumption

## Phase Boundaries

### Phase 1 → Phase 2 Boundary

**Trigger:** All individual files processed **Handoff:** Collection of Phase 1
results **Interface:** `AggregationService.aggregate()`

**Boundary Rules:**

- Phase 1 MUST complete for all files before Phase 2 starts
- Phase 1 results are immutable once passed to Phase 2
- No cross-file operations in Phase 1

### Phase 2 → Phase 3 Boundary

**Trigger:** Aggregation complete, unified dataset ready **Handoff:** Single
unified data object with `{@items}` array **Interface:**
`TemplateRenderer.render()`

**Boundary Rules:**

- Phase 2 MUST complete data aggregation before Phase 3 starts
- `{@items}` array is final and immutable in Phase 3
- No data transformation in Phase 3 (only formatting)

## Directive Processing by Phase

### Phase 1 Directives (Per-File Scope)

```
Stage 1: x-frontmatter-part       → Identify processing array
Stage 2: x-flatten-arrays         → Flatten if specified
Stage 3: x-jmespath-filter        → Filter data
Stage 4: x-derived-from           → Extract values
Stage 5: x-derived-unique         → Remove duplicates
```

### Phase 2 Directives (Cross-File Scope)

```
Stage 6: (Internal)               → Aggregate all file results
```

### Phase 3 Directives (Template Scope)

```
Stage 7: x-template               → Container template
Stage 7: x-template-items         → Item template
Stage 7: x-template-format        → Output format
```

## Current Implementation Status

### ✅ Well-Separated

- Phase 1: Document processing is isolated in `src/domain/document/`
- Phase 3: Template rendering is isolated in `src/domain/template/`

### ⚠️ Needs Clarification

- Phase 2: Aggregation logic mixed between:
  - `src/domain/aggregation/` (domain logic)
  - `src/application/services/pipeline-orchestrator.ts` (orchestration)
  - Phase boundary transitions not explicit in code

### 🔧 Improvements Needed

1. Add explicit phase markers in code comments
2. Document `HandoffContext` usage for phase transitions
3. Make phase boundaries explicit in PipelineOrchestrator
4. Add phase validation (ensure Phase N complete before Phase N+1)

## Code Organization by Phase

### Phase 1 Code

```
src/domain/document/            # Phase 1 domain
src/domain/schema/services/     # Schema directive processing (Stage 1-5)
  ├── directive-processor.ts
  └── schema-directive-processor.ts
```

### Phase 2 Code

```
src/domain/aggregation/         # Phase 2 domain
src/application/services/
  └── pipeline-orchestrator.ts  # Orchestrates Phase 1→2 transition
```

### Phase 3 Code

```
src/domain/template/            # Phase 3 domain
src/application/services/
  └── template-schema-coordinator.ts  # Coordinates Phase 2→3 transition
src/infrastructure/output/      # Output formatting
```

## Validation Rules

### Phase 1 Validation

- ✅ Each file processed independently
- ✅ No cross-file data access
- ✅ Stage 1-5 directives only

### Phase 2 Validation

- ✅ All Phase 1 results collected
- ✅ Single unified dataset produced
- ✅ `{@items}` array constructed

### Phase 3 Validation

- ✅ Templates loaded successfully
- ✅ All template variables resolved
- ✅ Output format valid

## Examples

### Example 1: Simple Processing Flow

**Input:** 3 markdown files with frontmatter

**Phase 1:**

```
file1.md → {commands: [{c1: "git"}]} → Phase 1 Result 1
file2.md → {commands: [{c1: "npm"}]} → Phase 1 Result 2
file3.md → {commands: [{c1: "deno"}]} → Phase 1 Result 3
```

**Phase 2:**

```
[Result 1, Result 2, Result 3] → Aggregation → {
  commands: [
    {c1: "git"},
    {c1: "npm"},
    {c1: "deno"}
  ]
}
```

**Phase 3:**

```
Unified Dataset + Template → Render → output.json
```

### Example 2: With Directives

**Phase 1 (per file):**

```
x-frontmatter-part: true       # Mark array for aggregation
x-flatten-arrays: "tags"       # Flatten nested arrays
x-derived-from: "items[].tag"  # Extract tag values
x-derived-unique: true         # Remove duplicates
```

**Phase 2 (cross-file):**

```
Merge all x-frontmatter-part arrays
Consolidate derived values
Build {@items} array
```

**Phase 3 (template):**

```
x-template: "container.json"   # Overall structure
x-template-items: "item.json"  # Per-item template
x-template-format: "yaml"      # Output as YAML
```

## Related Documentation

- [Schema Directives Specification](./schema-directives-specification.md)
- [Requirements (Japanese)](../requirements.ja.md)
- [Processing Flow Diagram](./processing-flow-diagram.md) (to be created)
- [Template Processing Specification](./template-processing-specification.md)

## Issue References

- Parent: #1218 - Directive Processing Architecture
- This document: #1229 - Document Phase Boundaries
