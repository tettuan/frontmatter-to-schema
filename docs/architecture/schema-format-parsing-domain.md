# Schema Format Parsing Domain Specification

## Executive Summary

This document clarifies where and how values are parsed according to Schema
format specifications. The **Schema Validation Domain** is responsible for
parsing raw frontmatter values into Schema-defined formats during the validation
process.

## Schema Format Parsing Responsibility

### Where: Schema Validation Domain

The **Schema Validation Domain** has dual responsibility:

1. **Validate** extracted frontmatter data against schema rules
2. **Parse and format** values according to Schema format definitions

### Why Not Other Domains?

- **Frontmatter Extraction Domain**: Only extracts raw syntax - doesn't know
  Schema format
- **Schema Processing Domain**: Only extracts Schema information - doesn't
  process data
- **Template Domains**: Only process templates - receive already-formatted
  values

## Processing Flow Detail

```
Raw Frontmatter Values → Schema Validation Domain → Schema-Formatted Values

Example:
  Raw: "2023-12-01"        →  Validation  →  Date: 2023-12-01T00:00:00Z
  Raw: "123.45"            →  Validation  →  Number: 123.45
  Raw: "true"              →  Validation  →  Boolean: true
  Raw: "item1,item2"       →  Validation  →  Array: ["item1", "item2"]
```

## Schema Format Definitions

Schema can define format specifications for values:

```json
{
  "templatePath": "templates/document.json",
  "fields": {
    "publishDate": {
      "type": "date",
      "format": "ISO8601",
      "required": true
    },
    "price": {
      "type": "number",
      "format": "decimal",
      "precision": 2
    },
    "tags": {
      "type": "array",
      "format": "comma-separated",
      "itemType": "string"
    },
    "enabled": {
      "type": "boolean",
      "format": "string-boolean"
    }
  }
}
```

## Schema Validation Domain Implementation

### Enhanced Responsibility

```typescript
interface SchemaValidationService {
  validateAndFormat(
    frontmatterData: FrontmatterData,
    schemaResult: SchemaResult,
  ): Promise<Result<FormattedValidationResult, ValidationError>>;
}

interface FormattedValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  rawValues: Record<string, unknown>; // Original frontmatter values
  schemaFormattedValues: Record<string, unknown>; // Values parsed per Schema format
  validationRules: ValidationRule[];
}
```

### Format Parsing Examples

#### Date Format Parsing

```typescript
// Schema defines: { type: "date", format: "ISO8601" }
// Raw frontmatter: publishDate: "2023-12-01"
// Parsed result: publishDate: Date(2023-12-01T00:00:00Z)

private parseDate(value: string, format: string): Date | ValidationError {
  switch (format) {
    case 'ISO8601':
      return new Date(value);
    case 'YYYY-MM-DD':
      // Parse specific format
      return this.parseYYYYMMDD(value);
    default:
      return new ValidationError(`Unsupported date format: ${format}`);
  }
}
```

#### Number Format Parsing

```typescript
// Schema defines: { type: "number", format: "decimal", precision: 2 }
// Raw frontmatter: price: "123.45"
// Parsed result: price: 123.45 (number with 2 decimal places)

private parseNumber(value: string, format: string, precision?: number): number | ValidationError {
  const num = parseFloat(value);

  if (format === 'decimal' && precision) {
    return Math.round(num * Math.pow(10, precision)) / Math.pow(10, precision);
  }

  return num;
}
```

#### Array Format Parsing

```typescript
// Schema defines: { type: "array", format: "comma-separated", itemType: "string" }
// Raw frontmatter: tags: "web,javascript,tutorial"
// Parsed result: tags: ["web", "javascript", "tutorial"]

private parseArray(value: string, format: string, itemType: string): unknown[] | ValidationError {
  switch (format) {
    case 'comma-separated':
      return value.split(',').map(item => item.trim());
    case 'space-separated':
      return value.split(' ').filter(item => item.length > 0);
    case 'newline-separated':
      return value.split('\n').map(item => item.trim());
    default:
      return new ValidationError(`Unsupported array format: ${format}`);
  }
}
```

#### Boolean Format Parsing

```typescript
// Schema defines: { type: "boolean", format: "string-boolean" }
// Raw frontmatter: enabled: "true"
// Parsed result: enabled: true

private parseBoolean(value: string, format: string): boolean | ValidationError {
  switch (format) {
    case 'string-boolean':
      const lower = value.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'off'].includes(lower)) return false;
      return new ValidationError(`Invalid boolean value: ${value}`);
    default:
      return Boolean(value);
  }
}
```

## Validation Flow with Format Parsing

```typescript
class SchemaValidationService {
  async validateAndFormat(
    frontmatterData: FrontmatterData,
    schemaResult: SchemaResult,
  ): Promise<Result<FormattedValidationResult, ValidationError>> {
    const formattedValues: Record<string, unknown> = {};
    const errors: ValidationError[] = [];

    // Parse each value according to Schema format
    for (const [key, rawValue] of Object.entries(frontmatterData.values)) {
      const fieldSchema = schemaResult.fieldDefinitions[key];

      if (fieldSchema) {
        // Parse according to Schema format
        const parsedValue = this.parseValueBySchema(rawValue, fieldSchema);

        if (parsedValue instanceof ValidationError) {
          errors.push(parsedValue);
        } else {
          formattedValues[key] = parsedValue;

          // Then validate the parsed value
          const validationResult = this.validateField(parsedValue, fieldSchema);
          if (!validationResult.isValid) {
            errors.push(...validationResult.errors);
          }
        }
      } else {
        // No schema definition - keep as raw value
        formattedValues[key] = rawValue;
      }
    }

    return success({
      isValid: errors.length === 0,
      errors,
      rawValues: frontmatterData.values,
      schemaFormattedValues: formattedValues,
      validationRules: schemaResult.validationRules,
    });
  }

  private parseValueBySchema(
    value: unknown,
    fieldSchema: FieldSchema,
  ): unknown | ValidationError {
    const stringValue = String(value);

    switch (fieldSchema.type) {
      case "date":
        return this.parseDate(stringValue, fieldSchema.format);
      case "number":
        return this.parseNumber(
          stringValue,
          fieldSchema.format,
          fieldSchema.precision,
        );
      case "boolean":
        return this.parseBoolean(stringValue, fieldSchema.format);
      case "array":
        return this.parseArray(
          stringValue,
          fieldSchema.format,
          fieldSchema.itemType,
        );
      case "string":
      default:
        return this.parseString(stringValue, fieldSchema.format);
    }
  }
}
```

## Integration with Template Domain

After Schema format parsing, the formatted values flow to Template Domain:

```typescript
// Application Coordination
const validationResult = await schemaValidationService.validateAndFormat(
  frontmatterData,
  schemaResult,
);

if (validationResult.ok && validationResult.data.isValid) {
  // Use Schema-formatted values for template processing
  const templateSource: TemplateSource = {
    templatePath: new TemplateFilePath(schemaResult.templatePath),
    valueSet: {
      values: {
        ...schemaResult.extractedValues, // Schema defaults
        ...validationResult.data.schemaFormattedValues, // Formatted frontmatter
      },
    },
  };

  // Pass formatted values to Template Domain
  return templateBuilderService.buildTemplate(templateSource);
}
```

## Domain Boundary Rules

### Schema Validation Domain MUST:

- Parse raw frontmatter values according to Schema format specifications
- Validate parsed values against Schema rules
- Return both raw and formatted values
- Handle format parsing errors gracefully

### Schema Validation Domain MUST NOT:

- Process templates
- Load template files
- Make template-related decisions
- Modify Schema definitions

### Other Domains MUST NOT:

- **Frontmatter Domain**: Parse according to Schema format (only extract raw)
- **Schema Domain**: Process frontmatter data (only extract Schema info)
- **Template Domain**: Parse or validate data (receive pre-formatted values)

## Error Handling

Format parsing errors are handled within Schema Validation Domain:

```typescript
interface FormatParsingError extends ValidationError {
  field: string;
  rawValue: unknown;
  expectedFormat: string;
  parseError: string;
}
```

Example error:

```json
{
  "field": "publishDate",
  "rawValue": "invalid-date",
  "expectedFormat": "ISO8601",
  "parseError": "Unable to parse 'invalid-date' as ISO8601 date"
}
```

## Testing Requirements

### Format Parsing Tests

```typescript
Deno.test("SchemaValidation - should parse date formats correctly", async () => {
  const rawData = { publishDate: "2023-12-01" };
  const schema = {
    fields: {
      publishDate: { type: "date", format: "ISO8601" },
    },
  };

  const result = await validator.validateAndFormat(rawData, schema);

  assertEquals(
    result.data.schemaFormattedValues.publishDate instanceof Date,
    true,
  );
});

Deno.test("SchemaValidation - should handle format parsing errors", async () => {
  const rawData = { publishDate: "invalid-date" };
  const schema = {
    fields: {
      publishDate: { type: "date", format: "ISO8601" },
    },
  };

  const result = await validator.validateAndFormat(rawData, schema);

  assertEquals(result.data.isValid, false);
  assertEquals(result.data.errors[0].field, "publishDate");
});
```

## Authority Statement

**Schema format parsing is the exclusive responsibility of the Schema Validation
Domain.**

This ensures:

- Centralized format handling
- Consistent parsing logic
- Clear domain boundaries
- Separation of concerns

**Violations of this boundary will result in architectural non-compliance.**

---

**Created**: December 2025 **Authority**: Canonical Architecture Documentation
**Enforcement**: MANDATORY
