# Domain FrontMatter Extraction

Extract structured data from Markdown frontmatter according to provided schema
definitions. This is the canonical domain-level prompt following DDD principles
and Totality.

## Input Requirements

- `frontmatter`: YAML frontmatter content (string)
- `schema`: Target JSON schema definition (object)
- `context`: Optional extraction context (string, nullable)

## Processing Rules

This function is total - it handles all possible input combinations:

1. **Valid Inputs**: Extract according to schema
2. **Invalid YAML**: Return structured error with parsing details
3. **Missing Schema Fields**: Use appropriate defaults or null
4. **Extra Frontmatter Fields**: Preserve in "additional" object
5. **Type Mismatches**: Attempt safe conversion, document failures

## Output Format

Always returns valid JSON with this total structure:

```json
{
  "success": boolean,
  "data": {
    // Schema-compliant extracted data
  } | null,
  "additional": {
    // Extra fields not in schema
  } | null,
  "errors": [
    {
      "field": string,
      "type": "missing" | "type_mismatch" | "parse_error",
      "message": string,
      "value": any
    }
  ],
  "metadata": {
    "extraction_time": string,
    "schema_version": string | null,
    "total_fields_processed": number
  }
}
```

## Domain Rules

- No partial functions: always returns complete response structure
- Type safety: all outputs conform to declared types
- Error transparency: all issues are captured and reported
- Schema compliance: extracted data strictly follows provided schema

## Implementation

Extract data following these priorities:

1. Direct field name matches
2. Semantic field matches (title → name, etc.)
3. Computed fields from multiple sources
4. Pattern-based extraction
5. Context-informed defaults

Return extracted data in the guaranteed response structure above.
