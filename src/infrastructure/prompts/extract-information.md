# Extract Information from FrontMatter

You are analyzing a Markdown document's frontmatter to extract structured
information according to a provided schema.

## FrontMatter Content

```
{{FRONTMATTER}}
```

## Target Schema

```json
{{SCHEMA}}
```

## Instructions

1. Analyze the frontmatter content carefully
2. Extract all relevant fields that match the schema
3. Handle missing fields gracefully (use null or appropriate defaults)
4. Preserve the original data types (string, number, boolean, array)
5. If a field exists in frontmatter but not in schema, include it in an "extra"
   field

## Output Format

Return the extracted data as a valid JSON object that conforms to the schema
structure.

Example output:

```json
{
  "field1": "value1",
  "field2": 123,
  "field3": true,
  "field4": ["item1", "item2"],
  "extra": {
    "unexpectedField": "value"
  }
}
```

Return ONLY the JSON object, no additional text or explanation.
