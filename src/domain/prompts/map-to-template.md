# Domain Template Mapping

Map extracted data to template structures following DDD principles and Totality.
This is the canonical domain-level template mapping prompt.

## Input Requirements

- `extracted_data`: Source data object (object)
- `template`: Target template structure (object)
- `mapping_rules`: Optional transformation rules (object, nullable)

## Processing Rules

This function is total - it handles all input scenarios:

1. **Valid Mapping**: Transform data according to template structure
2. **Missing Source Fields**: Apply defaults or leave as null per template
3. **Extra Source Fields**: Preserve in metadata unless explicitly excluded
4. **Type Transformations**: Apply safe conversions with error reporting
5. **Complex Mappings**: Handle nested structures and arrays correctly

## Output Format

Always returns complete mapping result:

```json
{
  "success": boolean,
  "mapped_data": {
    // Template-compliant mapped data
  } | null,
  "unmapped_fields": [
    {
      "field": string,
      "value": any,
      "reason": "no_target" | "type_incompatible" | "rule_rejected"
    }
  ],
  "transformations": [
    {
      "source_field": string,
      "target_field": string,
      "transformation": string,
      "original_value": any,
      "mapped_value": any
    }
  ],
  "errors": [
    {
      "field": string,
      "type": "mapping_error" | "type_error" | "validation_error",
      "message": string,
      "context": object
    }
  ],
  "metadata": {
    "mapping_time": string,
    "template_version": string | null,
    "fields_mapped": number,
    "fields_defaulted": number
  }
}
```

## Domain Mapping Rules

1. **Identity Mapping**: Direct field-to-field when names match
2. **Semantic Mapping**: Field meaning alignment (id → identifier)
3. **Structural Mapping**: Flatten/nest data structures as needed
4. **Computed Mapping**: Derive target fields from multiple sources
5. **Conditional Mapping**: Apply rules based on data values

## Type Safety

- All transformations preserve or safely convert types
- Invalid conversions are reported, not ignored
- Template constraints are validated
- Partial mappings are completed with appropriate defaults

This ensures total function behavior with complete error handling and data
preservation.
