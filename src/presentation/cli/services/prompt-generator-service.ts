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
   - Note field frequency and variations

2. **Define JSON Schema Properties**
   - Set appropriate data types (string, number, boolean, array, object)
   - Add field descriptions for documentation
   - Define validation rules:
     * enum for restricted values
     * pattern for regex validation
     * minLength/maxLength for strings
     * minimum/maximum for numbers
     * minItems/maxItems for arrays
   - Set default values where appropriate
   - Use additionalProperties: false for strict validation

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
      - Uses simple array notation: "commands[].propertyName"
      - Supports nested paths: "nested.items[].deep.property"
      - Example: "x-derived-from": "commands[].c1"
      - Note: Complex JMESPath filters are not supported

   e) **x-derived-unique** (Property-level):
      - Used with x-derived-from to ensure unique values
      - Removes duplicates from derived arrays
      - Example: "x-derived-unique": true

   f) **x-jmespath-filter** (Property-level):
      - Applies JMESPath expressions for advanced filtering
      - Supports complex queries and transformations
      - Example: "x-jmespath-filter": "items[?status=='active'].name"

   g) **x-template-format** (Schema-level):
      - Specifies the output format (json, yaml)
      - Overrides file extension detection
      - Example: "x-template-format": "yaml"


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
  "x-template-format": "json",
  "properties": {
    "version": {
      "type": "string",
      "default": "1.0.0",
      "description": "Registry version"
    },
    "description": {
      "type": "string",
      "default": "Command Registry",
      "description": "Registry description with default value"
    },
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "description": "Each item represents a separate markdown file",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique command identifier"
          },
          "name": {
            "type": "string",
            "description": "Command display name"
          },
          "c1": {
            "type": "string",
            "description": "Configuration type",
            "enum": ["basic", "advanced", "expert"]
          },
          "status": {
            "type": "string",
            "default": "active",
            "enum": ["active", "deprecated", "experimental"]
          },
          "tags": {
            "type": "array",
            "items": { "type": "string" },
            "default": []
          }
        },
        "required": ["id", "name"]
      }
    },
    "availableConfigs": {
      "type": "array",
      "x-derived-from": "commands[].c1",
      "x-derived-unique": true,
      "description": "Unique list of all configuration types",
      "items": { "type": "string" }
    },
    "activeCommands": {
      "type": "array",
      "x-jmespath-filter": "commands[?status=='active']",
      "description": "Filtered list of active commands only",
      "items": { "type": "object" }
    },
    "commandCount": {
      "type": "number",
      "x-jmespath-filter": "length(commands)",
      "description": "Total number of commands"
    },
    "tagCloud": {
      "type": "array",
      "x-derived-from": "commands[].tags[]",
      "x-derived-unique": true,
      "description": "All unique tags across commands",
      "items": { "type": "string" }
    }
  },
  "required": ["version", "commands"],
  "additionalProperties": false
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
    "commands": "{@items}",
    "activeCommands": "{activeCommands}"
  },
  "metadata": {
    "availableConfigs": "{availableConfigs}",
    "generatedAt": "{generatedAt}",
    "totalCommands": "{totalCommands}"
  }
}
\`\`\`

**command_template.json** (Item template for x-frontmatter-part array):
\`\`\`json
{
  "id": "{id}",
  "name": "{name}",
  "config": "{c1}",
  "tags": "{tags}",
  "status": "{status}",
  "metadata": {
    "source": "{sourceFile}",
    "processedAt": "{processedAt}"
  }
}
\`\`\`

**YAML Template Example (template.yaml):**
\`\`\`yaml
version: "{version}"
description: "{description}"
tools:
  commands: "{@items}"
  count: "{commandCount}"
metadata:
  configs: "{availableConfigs}"
  generated: "{timestamp}"
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
   - x-jmespath-filter: Advanced JMESPath filtering
   - x-template-format: Output format specification

3. **Template Variable Resolution**:
   - {fieldName}: Replaced with frontmatter field value
   - {@items}: Special placeholder for array expansion
   - Resolution order: Document → Schema defaults → Empty

4. **Processing Flow**:
   \`\`\`
   1. Discovery → 2. Extraction → 3. Validation → 4. Transform → 5. Aggregate → 6. Render
        ↓              ↓               ↓              ↓              ↓            ↓
   Find files   Parse YAML     Schema check   Apply derived   Combine      Template
   (glob/dir)   frontmatter    & defaults     fields         documents    output
                                              (JMESPath)                  (JSON/YAML)
   \`\`\`

5. **Best Practices**:
   - Analyze existing markdown files first
   - Define clear schema validation rules
   - Use x-frontmatter-part for multi-file arrays
   - Apply x-derived-from for aggregated fields
   - Use x-jmespath-filter for complex transformations
   - Test templates with sample data
   - Document custom extensions clearly
   - Follow DDD and Totality principles
   - Use discriminated unions for type safety

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 IMPLEMENTATION STEPS:

1. Scan all Markdown files matching the pattern
2. Extract and analyze frontmatter structures
3. Identify common fields and patterns
4. Design schema with appropriate types and validations
5. Add x-* extensions for enhanced functionality:
   - x-template/x-template-items for rendering
   - x-frontmatter-part for multi-file arrays
   - x-derived-from/x-derived-unique for aggregation
   - x-jmespath-filter for advanced queries
6. Create template files with variable placeholders
7. Test schema against sample documents
8. Validate output format (JSON/YAML)
9. Refine based on edge cases and requirements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 REAL-WORLD EXAMPLE:

Given these markdown files with frontmatter:

**command1.md:**
\`\`\`yaml
---
id: cmd-001
name: Build Project
c1: advanced
tags: [build, ci/cd]
status: active
---
\`\`\`

**command2.md:**
\`\`\`yaml
---
id: cmd-002
name: Run Tests
c1: basic
tags: [test, qa]
status: active
---
\`\`\`

The processing would:
1. Extract frontmatter from both files
2. Validate against the schema
3. Apply x-frontmatter-part to create array items
4. Process x-derived-from to extract unique configs: ["advanced", "basic"]
5. Apply x-jmespath-filter for activeCommands
6. Render using templates with {@items} expansion

Final output would combine all data into structured JSON/YAML.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 ADDITIONAL RESOURCES:

- Schema Specification: https://json-schema.org/draft-07/json-schema-release-notes.html
- JMESPath Documentation: https://jmespath.org/
- YAML Frontmatter Format: https://jekyllrb.com/docs/front-matter/
- DDD Principles: docs/development/totality.md
- Testing Strategy: docs/testing/comprehensive-test-strategy.md

For complex schemas, consider:
- Breaking into multiple schema files with $ref
- Using definitions for reusable components
- Implementing progressive validation
- Testing with edge cases and malformed data

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
1. JSON Schema with validation rules and x-* extensions
2. Template definitions using x-template and x-template-items
3. Variable resolution patterns with {variableName} syntax
4. Array processing with {@items} placeholder
5. Advanced filtering with x-jmespath-filter
6. Derived fields with x-derived-from and x-derived-unique
7. Format specification with x-template-format
8. Default value handling with standard JSON Schema defaults

Use this prompt with an AI assistant or as documentation
to understand the schema and template creation process.
`;
  }
}
