# List Output Definition - What It Is and What It Is Not

## Definitive Definition

### What List Output IS

**List Output** is the aggregated representation of multiple individual
documents, where:

1. **Multiple documents** → **Single output file**
2. **Document content** gets **transformed into list items**
3. **Container template** wraps the aggregated items
4. **Schema reuse via `$ref`** keeps item validation consistent while templates drive rendering

### Concrete Example

```yaml
# Input: 3 markdown files with frontmatter
# File 1: c1="git", c2="command"
# File 2: c1="spec", c2="analyze"
# File 3: c1="test", c2="run"

# Output: Single registry.json file
{
  "version": "1.0",
  "description": "Command Registry",
  "tools": {
    "commands": [
      { "c1": "git", "c2": "command" },
      { "c1": "spec", "c2": "analyze" },
      { "c1": "test", "c2": "run" },
    ],
  },
}
```

## What List Output IS NOT

### ❌ Not Individual File Processing

- **Wrong**: Processing each markdown file into separate output files
- **Wrong**: One-to-one document transformation
- **Example**: Creating `file1.json`, `file2.json`, `file3.json` separately

### ❌ Not Container Duplication

- **Wrong**: Creating multiple instances of the container template
- **Wrong**: Treating `index_*_template.json` as repeatable items
- **Example**: Having multiple `{"version": "1.0", "description": "..."}`
  objects

### ❌ Not Template-Level Processing

- **Wrong**: Processing template files themselves as data
- **Wrong**: Iterating over `index_design_template.json` as list content
- **Example**: Creating arrays of template structures

## Processing Flow Distinction

### Correct List Processing Flow

```
Multiple Markdown Files
    ↓ (Extract frontmatter)
Multiple FrontmatterData Objects
    ↓ (Apply item template: traceability_item_template.json)
Array of Processed Items
    ↓ (Apply container template: index_*_template.json)
Single List Output File
```

### Incorrect Processing (Current Problem)

```
Container Templates (index_*_template.json)
    ↓ (Incorrectly treat as items)
Array of Container Structures
    ↓ (Wrong aggregation)
Malformed List Output
```

## Key Architectural Distinctions

### 1. Item vs Container

- **Item**: Individual entry within the list (from
  `traceability_item_template.json`)
- **Container**: Wrapper structure for the entire list (from
  `index_*_template.json`)
- **Rule**: Items are many, Container is one

### 2. Data vs Template

- **Data**: Actual frontmatter content from markdown files
- **Template**: Structure definition for rendering
- **Rule**: Process data WITH templates, not templates AS data

### 3. Reference vs Definition

- **Reference**: `$ref` reuses schema substructures strictly for validation
- **Definition**: `x-template-items` selects the repeatable rendering template
- **Rule**: Keep schema reuse and template selection independent

## Real-World Analogy

### List Output = Bookshelf with Books

```
Container (Bookshelf):
- Has metadata: owner, location, capacity
- Rendered once from container template

Items (Books):
- Individual book entries
- Many books on one shelf
- Each rendered from item template
```

### What We DON'T Want (Current Problem)

```
Multiple Bookshelves:
- Each "bookshelf" contains one book
- No actual aggregation
- Defeats the purpose of having a list
```

## Validation Rules

### List Output Must Have:

1. **Single output file** (not multiple)
2. **Container wrapping** the items
3. **Array of items** inside the container
4. **Item schema validated via `$ref` while templates control rendering**

### List Output Must NOT Have:

1. **Multiple container instances**
2. **Template files as content**
3. **One-to-one file mapping**
4. **Container structures as list items**

## Authority

This definition establishes the authoritative meaning of "List Output" for this
project. Any implementation that violates these principles is architecturally
incorrect and must be corrected.
