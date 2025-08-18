# Generic Information Extraction from FrontMatter

You are an expert data analyst specializing in structured information extraction
from metadata.

## Task

Extract structured information from the provided frontmatter data according to
the given schema definition. This is a generic extraction that should work with
any schema and frontmatter combination.

## Input Data

### FrontMatter Content

```yaml
{ frontmatter }
```

### Target Schema Definition

```json
{schema}
```

### Extraction Context (Optional)

{context}

## Processing Instructions

1. **Schema Analysis**
   - Identify all required fields in the schema
   - Note data types for each field
   - Understand nested structures and arrays

2. **FrontMatter Mapping**
   - Map frontmatter fields to schema fields
   - Look for semantic matches even if field names differ
   - Handle nested data structures appropriately

3. **Data Transformation**
   - Convert data types as needed (string to number, etc.)
   - Parse complex fields (comma-separated to array, etc.)
   - Apply any context-specific rules

4. **Missing Data Handling**
   - Use sensible defaults for missing optional fields
   - For required fields, attempt to infer from other data
   - Mark clearly if required data cannot be determined

## Extraction Strategy

- **Direct Mapping**: If field names match exactly
- **Semantic Mapping**: If field meanings align (e.g., "title" → "name")
- **Computed Fields**: Derive from multiple source fields
- **Pattern Matching**: Extract from text fields using patterns
- **Contextual Inference**: Use domain knowledge when provided

## Output Requirements

Return a JSON object that:

1. Strictly conforms to the provided schema structure
2. Contains all fields defined in the schema
3. Maintains correct data types
4. Preserves the semantic meaning of the original data

## Output Format

Return ONLY valid JSON without any additional text, markdown formatting, or
explanations.

The output must be directly parseable as JSON and match the schema structure
exactly.

Example (do not include this in actual output):

- If schema requires `{"name": "string", "count": "number"}`
- Return: `{"name": "example", "count": 42}`
