# Template Processing Clarification

## Core Principle

**Template defines output format EXACTLY. Only what is written in the template will be output.**

This is a fundamental, non-negotiable principle of the system. The template is the sole authority for output structure - no inference, no completion, no Schema-based augmentation.

### Correct Understanding
```json
// Template: simple_template.json
"{id.full}"

// Output (with id.full = "req:api:test")
"req:api:test"

// NOTE: This outputs ONLY the string value, not an object
```

### INCORRECT Assumptions
❌ "Schema structure will be used when template is partial"
❌ "x-frontmatter-part arrays have special processing"
❌ "Template can be simplified and system will infer full structure"
❌ "System will wrap values in objects based on Schema"

## Template Variable Resolution

1. **Template is the authority** - defines exact output format
2. **Variables are replaced** - {variable.path} → actual value
3. **Nothing else is added** - no Schema structure inference

## Array Processing with x-frontmatter-part

When `x-frontmatter-part: true`:
- Each frontmatter item is processed
- Template is applied to EACH item
- Template must define complete desired structure

### Example
```json
// Schema with x-frontmatter-part
{
  "items": {
    "$ref": "item_schema.json",
    "x-frontmatter-part": true
  }
}

// item_template.json MUST define complete structure
{
  "id": "{id}",
  "name": "{name}",
  "status": "{status}"
}

// NOT just:
"{id}"  // This would only output the id value
```

## Common Misunderstandings

### Misunderstanding 1: "Schema defines output structure"
**Reality**: Schema defines validation/parsing structure. Template defines output structure.

### Misunderstanding 2: "Partial templates are completed by Schema"
**Reality**: Templates are never "completed". They define exactly what outputs.

### Misunderstanding 3: "x-frontmatter-part has special template handling"
**Reality**: Same template rules apply. Each array item gets the template applied.

## Real-World Example: Traceability Items

### Problem Case
```json
// traceability_item_template.json (INCORRECT - produces string array)
"{id.full}"

// Expected output (but WON'T happen):
[
  { "id": {...}, "summary": "...", ... },  // Full objects
  { "id": {...}, "summary": "...", ... }
]

// Actual output (what WILL happen):
[
  "req:api:001",  // Just strings
  "req:api:002"
]
```

### Solution
```json
// traceability_item_template.json (CORRECT - defines full structure)
{
  "id": {
    "full": "{id.full}",
    "level": "{id.level}",
    "scope": "{id.scope}",
    "semantic": "{id.semantic}",
    "hash": "{id.hash}",
    "version": "{id.version}"
  },
  "summary": "{summary}",
  "description": "{description}",
  "status": "{status}"
}

// Now produces correct output:
[
  {
    "id": {
      "full": "req:api:001",
      "level": "api",
      // ... all fields
    },
    "summary": "API requirement",
    // ... all fields
  }
]
```

## Key Takeaways

1. **Template = Output**: What you write in the template is exactly what you get
2. **No Magic**: System does NOT infer, complete, or augment templates
3. **Be Explicit**: Always define complete structure in templates
4. **Schema ≠ Template**: Schema validates data; Template formats output