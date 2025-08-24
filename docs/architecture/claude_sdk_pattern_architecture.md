# Claude SDK Pattern Architecture

## Overview

This architecture implements a two-phase processing pattern using Claude AI CLI (`claude -p`) for analyzing and extracting structured data from Markdown frontmatter according to defined schemas.

## Architecture Principles

### 1. Separation of Concerns

The system separates processing into distinct phases to maintain consistency and reliability:
- **Phase 1: Extraction** - Extract raw data from frontmatter
- **Phase 2: Mapping** - Map extracted data to schema structure

### 2. Command Line SDK Integration

The system uses Claude's command-line interface through:
- `claude -p <prompt_file>` - Sends prompt from file to Claude
- `--dangerously-skip-permissions` - Bypasses permission checks for automation
- Temperature control via environment variable for consistency

## Processing Flow

### Phase 1: Data Extraction

#### 1.1 TypeScript Preprocessing

Before calling Claude, TypeScript performs deterministic extraction:

1. **Extract frontmatter from markdown**
   - Parse YAML data structure
   - Validate YAML syntax
   - Preserve original structure

2. **Extract template variables** `{variable}` from templates
   - Identify placeholder patterns
   - Build variable mapping

```typescript
// Extract frontmatter from markdown
const frontMatter = extractFrontMatter(markdown);

// Extract template variables like {variable}
const templateVars = extractTemplateVariables(template);
```

#### 1.2 Claude Extraction Processing

The extraction prompt is structured to:
1. Parse YAML frontmatter data
2. Identify all fields present in the frontmatter
3. Extract values with type inference
4. Handle naming variations and structural mismatches
5. Return structured JSON output

**Key Rules:**
- Do not modify values - preserve original data
- Do not create values for non-existent items
- Handle field naming variations (e.g., `title` vs `name` vs `heading`)
- Fix hierarchical structure mismatches

**Extraction Prompt Template:**
```markdown
Extract the following frontmatter data according to the provided schema.

FrontMatter: {{FRONTMATTER}}

Schema: {{SCHEMA}}

Instructions:
1. Parse the frontmatter YAML data
2. Extract fields that match the schema
3. Return ONLY a valid JSON object containing the extracted data
4. The JSON should directly map to the schema structure
5. Use null for missing required fields
6. Ignore extra fields not in the schema

Return your response as a single JSON object with no additional text.
```

### Phase 2: Schema Mapping

#### 2.1 Template Variable Processing

Map extracted data to template variables:
- Match extracted fields to template placeholders
- Apply field transformations as needed
- Handle missing fields with defaults

#### 2.2 Claude Mapping Processing

The mapping prompt transforms extracted data:
1. Apply schema constraints
2. Transform data types as needed
3. Ensure all required fields are present
4. Return final output structure

**Mapping Prompt Template:**
```markdown
Map the extracted data to the schema structure.

Extracted Data: {{EXTRACTED_DATA}}

Schema: {{SCHEMA}}

Instructions:
1. Transform the extracted data to match schema types
2. Apply any required field mappings
3. Ensure all required fields are present
4. Return the final mapped JSON object
```

## Implementation Details

### ClaudeSchemaAnalyzer Class

```typescript
export class ClaudeSchemaAnalyzer implements SchemaAnalyzer {
  constructor(
    private readonly config: AnalysisConfiguration,
    private readonly extractionPromptTemplate: string,
    private readonly mappingPromptTemplate: string,
  ) {}

  async analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, ProcessingError>> {
    // Phase 1: Extraction
    const extractionPrompt = this.prepareExtractionPrompt(
      frontMatter.getRaw(),
      schema.getDefinition().getValue(),
    );
    const extractionResult = await this.callClaudeAPI(extractionPrompt);
    const extractedData = this.parseExtractionResult(extractionResult.data);

    // Phase 2: Mapping
    const mappingPrompt = this.prepareMappingPrompt(
      extractedData,
      schema.getDefinition().getValue(),
    );
    const mappingResult = await this.callClaudeAPI(mappingPrompt);
    const mappedData = this.parseMappingResult(mappingResult.data);

    return { ok: true, data: ExtractedData.create(mappedData) };
  }
}
```

### Claude API Integration

#### Command Execution

```typescript
private async callClaudeAPI(prompt: string): Promise<Result<string, AIError>> {
  // Prompt length validation
  if (prompt.length > 100000) {
    return { ok: false, error: createError({ kind: "PromptTooLong" }) };
  }

  // Create temporary file for prompt
  const tempFile = await Deno.makeTempFile({ suffix: ".md" });
  await Deno.writeTextFile(tempFile, prompt);

  // Execute claude command
  const command = new Deno.Command("claude", {
    args: ["--dangerously-skip-permissions", "-p", tempFile],
    stdout: "piped",
    stderr: "piped",
  });

  // Handle timeout (60 seconds)
  const result = await Promise.race([
    command.output(),
    timeoutPromise(60000),
  ]);

  // Clean up temp file
  await Deno.remove(tempFile);

  return parseResult(result);
}
```

#### Response Parsing

```typescript
private parseExtractionResult(response: string): Record<string, unknown> | null {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Try direct JSON parse
    return JSON.parse(response);
  } catch {
    // Fallback to key-value parsing
    return parseKeyValuePairs(response);
  }
}
```

## Configuration

### Environment Variables

- `FRONTMATTER_VERBOSE_MODE`: Enable detailed logging
- `FRONTMATTER_CLAUDE_TEMPERATURE`: Control response consistency (default: 0.1)
- `FRONTMATTER_TO_SCHEMA_TEST_MODE`: Enable mock mode for testing

### Prompt Templates

Prompt templates are configurable and injected via constructor:
- `extractionPromptTemplate`: Template for data extraction phase
- `mappingPromptTemplate`: Template for schema mapping phase

## Error Handling

### Error Types

1. **PromptTooLong**: Prompt exceeds 100,000 character limit
2. **APIError**: Claude CLI execution failed
3. **AnalysisFailed**: Parsing or processing failed
4. **Timeout**: API call exceeded 60-second timeout

### Recovery Strategies

- Automatic temp file cleanup on error
- Process termination on timeout via `pkill`
- Graceful degradation with fallback parsing
- Comprehensive error logging in verbose mode

## Logging System

### LoggerFactory Integration

The system uses a centralized logging approach via `LoggerFactory`:

```typescript
const verboseLogger = LoggerFactory.createLogger("claude-schema-analyzer");
verboseLogger.info("Preparing frontmatter extraction prompt");
verboseLogger.debug("Extraction prompt preview", {
  preview: extractionPrompt.substring(0, 200) + "...",
});
```

### Verbose Mode Output

When `FRONTMATTER_VERBOSE_MODE=true`, the system provides detailed logging:
- Info level: Major processing steps
- Debug level: Detailed data and previews
- Error level: Failure details and stack traces

## Benefits of This Architecture

### 1. Reliability
- Two-phase processing ensures consistency
- Separation allows targeted error handling
- Each phase can be validated independently

### 2. Flexibility
- Configurable prompt templates
- Extensible parsing strategies
- Environment-based configuration

### 3. Maintainability
- Clear separation of concerns
- Domain-driven design principles
- Comprehensive logging and debugging

### 4. Performance
- 60-second timeout prevents hanging
- Temp file cleanup prevents resource leaks
- Efficient JSON parsing with fallbacks

## Testing Strategy

### Unit Testing
- Mock Claude CLI responses
- Test prompt preparation
- Test response parsing

### Integration Testing
- Test with real Claude CLI
- Validate end-to-end flow
- Test error scenarios

### Test Mode

When `FRONTMATTER_TO_SCHEMA_TEST_MODE=true`:
- Uses mock responses instead of Claude CLI
- Enables deterministic testing
- Faster test execution

## Example Usage

### Extraction Phase Example

**Input Frontmatter:**
```yaml
title: Test Command
description: Test command for demo
```

**Schema:**
```json
{
  "title": { "type": "string" },
  "description": { "type": "string" }
}
```

**Claude Response:**
```json
{
  "title": "Test Command",
  "description": "Test command for demo"
}
```

### Mapping Phase Example

**Extracted Data:**
```json
{
  "title": "Test Command",
  "description": "Test command for demo"
}
```

**Template Variables:**
```
{COMMAND_NAME}
{COMMAND_DESC}
```

**Mapped Result:**
```json
{
  "COMMAND_NAME": "Test Command",
  "COMMAND_DESC": "Test command for demo"
}
```

## Future Enhancements

1. **Caching**: Cache Claude responses for identical prompts
2. **Batch Processing**: Process multiple frontmatters in parallel
3. **Streaming**: Support streaming responses for large datasets
4. **Retry Logic**: Implement exponential backoff for API failures
5. **Multiple Models**: Support different Claude models via configuration
6. **Metrics Collection**: Track processing times and success rates
7. **Schema Validation**: Add JSON Schema validation layer
8. **Custom Transformers**: Allow plugin-based field transformations