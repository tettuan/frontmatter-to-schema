# Map Extracted Data to Template Structure

You are mapping extracted data to a specific template structure according to a provided schema.

## Extracted Data
```json
{{EXTRACTED_DATA}}
```

## Target Schema
```json
{{SCHEMA}}
```

## Instructions
1. Transform the extracted data to match the exact structure defined in the schema
2. Apply any necessary data transformations:
   - Convert date strings to the required format
   - Normalize string values (trim, lowercase, etc.)
   - Ensure arrays are properly formatted
   - Apply default values where specified in schema
3. Validate that all required fields are present
4. Remove any fields not defined in the schema (unless schema allows additionalProperties)

## Transformation Rules
- Date fields: Convert to ISO 8601 format (YYYY-MM-DD HH:mm)
- Boolean fields: Ensure true/false values (not strings)
- Array fields: Ensure proper array structure, not comma-separated strings
- String fields: Trim whitespace, apply any format constraints

## Output Format
Return the mapped data as a valid JSON object that exactly matches the schema structure.

Example output:
```json
{
  "title": "Mapped Title",
  "type": "tech",
  "published": true,
  "published_at": "2025-08-01 10:00",
  "topics": ["topic1", "topic2"]
}
```

Return ONLY the JSON object, no additional text or explanation.