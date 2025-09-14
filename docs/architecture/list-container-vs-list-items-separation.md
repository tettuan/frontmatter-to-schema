# List Container vs List Items Separation

## Problem Identification

A fundamental design confusion exists in the current list processing
implementation, violating the separation between:

1. **List Container** - The outer structure (header/footer/metadata)
2. **List Items** - The actual content to be aggregated

## Current Problematic Pattern

### Incorrect Implementation

The system currently treats container templates as list items:

```
.agent/spec-trace/index_design_template.json  <- Container template (NOT list item)
.agent/spec-trace/index_design_schema.json    <- Container schema (NOT list item)

Being processed as array elements in:
.agent/spec-trace/index/design_index.json     <- Should contain actual items, not containers
```

### Correct Pattern Should Be

```
Container: index_design_template.json
  └── References: "$ref": "traceability_item_schema.json"
      └── Template: traceability_item_template.json  <- These are the ACTUAL list items
```

## Architectural Violation Analysis

### Domain Boundary Confusion

- **Container Domain**: Manages list structure (version, description, metadata)
- **Item Domain**: Manages individual entries within the list
- **Current Issue**: Container templates being processed as items

### Template Hierarchy Misconception

```typescript
// WRONG: Treating container as item
interface IncorrectListProcessing {
  items: ContainerTemplate[]; // This is wrong!
}

// CORRECT: Separating container from items
interface CorrectListProcessing {
  container: ContainerTemplate;
  items: ItemTemplate[]; // Referenced via $ref
}
```

## Root Cause Analysis

### 1. Template Reference Misinterpretation

- Container templates define the outer structure
- `$ref` references point to the actual repeatable item template
- System incorrectly processes containers instead of referenced items

### 2. List Aggregation Logic Error

- List aggregation should process `traceability_item_template.json` instances
- NOT process `index_*_template.json` containers
- Container is rendered ONCE with aggregated items

### 3. Schema-Template Relationship Confusion

```yaml
# Container Schema (index_design_schema.json)
properties:
  items:
    type: array
    items:
      $ref: "traceability_item_schema.json" # This points to the REAL items

# The system should follow the $ref, not process the container
```

## Correct Architecture

### List Container Subdomain

**Responsibility**: Manage list outer structure

```
- Input: Aggregated items + metadata
- Processing: Apply container template once
- Output: Single file with wrapped content
- Template: index_*_template.json (container)
```

### List Items Subdomain

**Responsibility**: Process individual list entries

```
- Input: Individual frontmatter documents
- Processing: Apply item template per document
- Output: Array of processed items
- Template: traceability_item_template.json (items)
```

### Correct Processing Flow

1. **Items Processing**: Process each document with
   `traceability_item_template.json`
2. **Container Wrapping**: Wrap processed items with `index_*_template.json`
3. **Reference Resolution**: Follow `$ref` to find actual item templates

## Implementation Fix Requirements

### 1. Template Resolution Logic

```typescript
interface TemplateProcessor {
  // WRONG
  processContainerAsItem(containerTemplate: ContainerTemplate): ItemOutput[];

  // CORRECT
  processContainer(
    container: ContainerTemplate,
    items: ItemOutput[],
  ): ContainerOutput;
  processItems(documents: Document[], itemTemplate: ItemTemplate): ItemOutput[];
}
```

### 2. Reference Following

- When encountering `$ref`, follow to referenced template
- Container templates are NOT iterated over
- Only referenced item templates are used for iteration

### 3. Clear Type Distinction

```typescript
type ContainerTemplate = {
  version: string;
  description: string;
  items: ItemReference; // Points to actual items via $ref
};

type ItemTemplate = {
  // Actual structure for individual entries
  [key: string]: TemplateVariable;
};
```

## Authority

This architectural principle establishes the definitive separation between list
containers and list items. All list processing must distinguish between:

- Container templates (rendered once)
- Item templates (rendered per document, referenced via $ref)

Failure to maintain this separation results in fundamental processing errors and
architectural violations.
