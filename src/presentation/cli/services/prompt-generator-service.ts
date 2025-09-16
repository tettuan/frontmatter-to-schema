import { ok, Result } from "../../../domain/shared/types/result.ts";
import { DomainError } from "../../../domain/shared/types/errors.ts";

/**
 * Service to generate prompts for Schema and Template creation
 * Following DDD and Totality principles
 */
export class PromptGeneratorService {
  private constructor() {}

  static create(): Result<PromptGeneratorService, DomainError> {
    return ok(new PromptGeneratorService());
  }

  /**
   * Generate a comprehensive prompt for Schema and Template creation
   */
  generateSchemaTemplatePrompt(
    schemaPath: string,
    inputPattern: string,
  ): string {
    return `Schema and Template Creation Prompt:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 TASK: Create a JSON Schema and Template Structure

Based on the Markdown files matching pattern: ${inputPattern}
Target schema file: ${schemaPath}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 SCHEMA CREATION APPROACH:

1. **Analyze Frontmatter Structure**
   - Extract all frontmatter fields from files matching: ${inputPattern}
   - Identify common patterns and field types
   - Determine required vs optional fields
   - Detect nested structures and arrays

2. **Define JSON Schema Properties**
   - Set appropriate data types (string, number, boolean, array, object)
   - Add field descriptions and examples
   - Define validation rules (pattern, minLength, maxLength, etc.)
   - Set default values where appropriate

3. **Schema Extensions (x-* Properties)**
   The schema uses custom extensions for enhanced functionality:

   a) **x-template** (Schema-level):
      - Specifies the template file for rendering output
      - Example: "x-template": "registry_template.json"

   b) **x-template-items** (Schema-level):
      - Template file for array items when using dual-template rendering
      - Used with x-frontmatter-part arrays
      - Example: "x-template-items": "item_template.json"

   c) **x-frontmatter-part** (Property-level):
      - Marks arrays where each item represents a separate markdown file
      - When true, each array item is processed individually
      - Example: "x-frontmatter-part": true

   d) **x-derived-from** (Property-level):
      - Creates derived fields by aggregating from nested properties
      - Uses dot-path expressions: "commands[].propertyName"
      - Example: "x-derived-from": "commands[].c1"

   e) **x-derived-unique** (Property-level):
      - Used with x-derived-from to ensure unique values
      - Removes duplicates from derived arrays
      - Example: "x-derived-unique": true

4. **Template Variable Resolution**
   Variables in templates (e.g., {version}, {name}) are resolved from:
   - Current document's frontmatter fields
   - Schema-defined default values
   - Empty string if unresolved

5. **Array Expansion with {@items}**

   CRITICAL: {@items} placement rules:

   ✅ CORRECT - As object property value:
   \`\`\`json
   {
     "tools": {
       "commands": "{@items}"
     }
   }
   \`\`\`
   Result: {@items} is replaced with actual array data

   ❌ INCORRECT - Inside array literal:
   \`\`\`json
   {
     "tools": {
       "commands": ["{@items}"]
     }
   }
   \`\`\`
   Result: {@items} remains as string literal

   Key Rules:
   - {@items} must be the complete property value
   - Cannot be embedded in arrays or other structures
   - Use exact match: "property": "{@items}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 EXAMPLE SCHEMA STRUCTURE:

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "registry_template.json",
  "x-template-items": "command_template.json",
  "properties": {
    "version": {
      "type": "string",
      "default": "1.0.0"
    },
    "description": {
      "type": "string"
    },
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "c1": { "type": "string" },
          "tags": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["id", "name"]
      }
    },
    "availableConfigs": {
      "type": "array",
      "x-derived-from": "commands[].c1",
      "x-derived-unique": true,
      "items": { "type": "string" }
    }
  },
  "required": ["version", "commands"]
}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 EXAMPLE TEMPLATE FILES:

**registry_template.json** (Main template):
\`\`\`json
{
  "version": "{version}",
  "description": "{description}",
  "tools": {
    "commands": "{@items}"
  },
  "availableConfigs": "{availableConfigs}"
}
\`\`\`

**command_template.json** (Item template for x-frontmatter-part array):
\`\`\`json
{
  "id": "{id}",
  "name": "{name}",
  "config": "{c1}",
  "tags": "{tags}"
}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 KEY CONCEPTS:

1. **Two-Stage Processing**:
   - Stage 1: Extract frontmatter from markdown files
   - Stage 2: Apply templates to transform data

2. **Schema Extensions Summary**:
   - x-template: Main template file path
   - x-template-items: Item template for arrays
   - x-frontmatter-part: Marks arrays of individual files
   - x-derived-from: Aggregate values from nested data
   - x-derived-unique: Remove duplicates

3. **Template Variable Resolution**:
   - {fieldName}: Replaced with frontmatter field value
   - {@items}: Special placeholder for array expansion
   - Resolution order: Document → Schema defaults → Empty

4. **Processing Flow**:
   \`\`\`
   Markdown Files → Frontmatter Extraction → Schema Validation
        ↓                                           ↓
   Template Application ← Aggregation ← Default Population
        ↓
   Output (JSON/YAML)
   \`\`\`

5. **Best Practices**:
   - Analyze existing markdown files first
   - Define clear schema validation rules
   - Use x-frontmatter-part for multi-file arrays
   - Test templates with sample data
   - Document custom extensions clearly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 IMPLEMENTATION STEPS:

1. Scan all Markdown files matching the pattern
2. Extract and analyze frontmatter structures
3. Identify common fields and patterns
4. Design schema with appropriate types and validations
5. Add template extensions where dynamic content is needed
6. Define derived fields using JMESPath expressions
7. Test schema against sample documents
8. Refine based on edge cases and requirements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  /**
   * Generate a brief usage hint
   */
  generateUsageHint(): string {
    return `
💡 Using --generate-prompt:

This option outputs a comprehensive guide for creating:
1. JSON Schema with validation rules
2. Template definitions using x-template and x-template-items
3. Variable resolution patterns with {variableName} syntax
4. Array processing with {@items} placeholder

Use this prompt with an AI assistant or as documentation
to understand the schema and template creation process.
`;
  }
}
