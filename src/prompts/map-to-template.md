# Generic Template Mapping

You are an expert in data transformation and template mapping.

## Task

Map the provided extracted data to the given template structure, creating a
properly formatted output that combines multiple data sources into the final
structure.

## Input Data

### Extracted Data

```json
{extracted_data}
```

### Target Template

```json
{template}
```

### Mapping Rules (Optional)

```json
{mapping_rules}
```

## Processing Instructions

1. **Template Analysis**
   - Identify all placeholders in the template
   - Understand the hierarchical structure
   - Note any arrays or nested objects

2. **Data Mapping**
   - Fill template placeholders with extracted data
   - Handle arrays by creating multiple entries as needed
   - Preserve template structure exactly

3. **Aggregation Rules**
   - When multiple data items map to arrays, include all
   - Merge data from different sources when specified
   - Maintain uniqueness where required

4. **Transformation Rules**
   - Apply any specified transformations
   - Format data according to template requirements
   - Handle data type conversions

## Mapping Strategies

- **Direct Replacement**: Replace template placeholders with data values
- **Array Population**: Fill array templates with multiple data items
- **Nested Mapping**: Recursively map nested structures
- **Conditional Inclusion**: Include optional sections based on data
  availability
- **Data Aggregation**: Combine multiple data sources into single fields

## Special Handling

### For Arrays

- If template has an array, populate with all matching data items
- Maintain order if specified in rules
- Remove duplicates if uniqueness is required

### For Nested Objects

- Recursively apply mapping to nested structures
- Preserve hierarchical relationships
- Handle missing nested data gracefully

### For Missing Data

- Keep template defaults if provided
- Use empty values appropriate to data type
- Omit optional fields if no data available

## Output Requirements

Return a JSON object that:

1. Exactly matches the template structure
2. Contains all mapped data from the extraction
3. Preserves data types as defined in template
4. Maintains semantic correctness

## Output Format

Return ONLY valid JSON without any additional text, markdown formatting, or
explanations.

The output must be directly parseable as JSON and match the template structure
exactly.

Note:

- Arrays should contain all relevant items
- Nested objects should be fully populated
- The final structure should be complete and valid
