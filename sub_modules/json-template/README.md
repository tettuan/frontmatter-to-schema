# JSON Template Processor

A TypeScript/Deno module for processing JSON templates with variable
substitution support. This module provides dot notation and array access for
complex data structures while maintaining simplicity and performance.

## Features

- **Variable Substitution**: Replace `{variable.path}` placeholders with actual
  data values
- **Dot Notation**: Access nested objects with `{user.profile.name}`
- **Array Access**: Access array elements with `{items[0]}` or `{users[1].name}`
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Detailed error messages with context for debugging
- **Performance**: Optimized for large data structures and templates
- **Validation**: Template and variable validation utilities

## Installation

```bash
# Import directly in your Deno project
import { createTemplateProcessor } from "https://deno.land/x/json_template_processor/mod.ts";
```

## Quick Start

### Basic Usage

```typescript
import { createTemplateProcessor } from "./src/mod.ts";

// Create processor
const processor = createTemplateProcessor();

// Your data
const data = {
  name: "My App",
  version: "1.0.0",
  author: { name: "John Doe" },
};

// Process template file
const result = await processor.process(data, "./template.json");
console.log(result);
```

### Template Example

**template.json:**

```json
{
  "appName": "{name}",
  "appVersion": "{version}",
  "authorName": "{author.name}"
}
```

**Output:**

```json
{
  "appName": "My App",
  "appVersion": "1.0.0",
  "authorName": "John Doe"
}
```

### Complex Example with Arrays

**Data:**

```typescript
const data = {
  tools: {
    availableConfigs: ["git", "test", "spec"],
    commands: [
      {
        c1: "git",
        c2: "create",
        title: "Create Git Issue",
        options: {
          input: ["file", "stdin"],
        },
      },
    ],
  },
};
```

**Template:**

```json
{
  "primaryTool": "{tools.availableConfigs[0]}",
  "commandTitle": "{tools.commands[0].title}",
  "inputOptions": "{tools.commands[0].options.input}",
  "allConfigs": "{tools.availableConfigs}"
}
```

## API Reference

### JsonTemplateProcessor

Main interface for template processing.

```typescript
interface JsonTemplateProcessor {
  process(jsonData: unknown, templateFilePath: string): Promise<unknown>;
}
```

### Creating a Processor

```typescript
import {
  createTemplateProcessor,
  JsonTemplateProcessorImpl,
} from "./src/mod.ts";

// Factory function (recommended)
const processor = createTemplateProcessor();

// Direct instantiation
const processor = new JsonTemplateProcessorImpl();
```

### Variable Resolution

The `VariableResolver` class handles path resolution:

```typescript
import { VariableResolver } from "./src/mod.ts";

const resolver = new VariableResolver(data);

// Resolve paths
const value = resolver.resolve("user.name");
const exists = resolver.exists("user.email");

// Extract variables from template
const variables = VariableResolver.extractVariables(templateString);
```

### Template Validation

```typescript
const processor = createTemplateProcessor();

// Extract variables from template
const variables = processor.validateTemplate(templateContent);

// Validate all variables can be resolved
const validation = processor.validateVariables(templateContent, data);
if (!validation.valid) {
  console.log("Missing variables:", validation.missingVariables);
}
```

## Path Syntax

### Simple Properties

```
{propertyName} → data.propertyName
```

### Dot Notation

```
{user.profile.name} → data.user.profile.name
```

### Array Access

```
{items[0]} → data.items[0]
{users[1].name} → data.users[1].name
```

### Complex Paths

```
{tools.commands[0].options.input[1]} → data.tools.commands[0].options.input[1]
```

## Error Handling

The module provides specific error types for different failure scenarios:

```typescript
import {
  InvalidJsonError,
  TemplateNotFoundError,
  TemplateReadError,
  VariableNotFoundError,
} from "./src/mod.ts";

try {
  const result = await processor.process(data, templatePath);
} catch (error) {
  if (error instanceof VariableNotFoundError) {
    console.error(`Variable not found: ${error.variablePath}`);
  } else if (error instanceof TemplateNotFoundError) {
    console.error(`Template file not found: ${error.templatePath}`);
  }
  // ... handle other error types
}
```

## Limitations

- **No Array Expansion**: `{@items}` syntax is not supported
- **No Recursive Variables**: `{{nested.variable}}` patterns are not supported
- **File-based Templates**: Templates must be stored in files (not in-memory
  strings)
- **JSON Output Only**: Templates must result in valid JSON

## Development

### Running Tests

```bash
# Run all tests
deno task test

# Run with coverage
deno task test:coverage

# Watch mode
deno task test:watch
```

### Code Quality

```bash
# Lint code
deno task lint

# Format code
deno task fmt

# Type check
deno task check
```

## Examples

See the `tests/` directory for comprehensive usage examples:

- `tests/template-processor_test.ts` - Basic template processing
- `tests/variable-resolver_test.ts` - Variable resolution examples
- `tests/integration_test.ts` - Real-world scenarios
- `tests/edge-cases_test.ts` - Edge cases and performance tests

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for your changes
4. Ensure all tests pass
5. Submit a pull request

Please ensure your code follows the existing style and includes appropriate
tests.
