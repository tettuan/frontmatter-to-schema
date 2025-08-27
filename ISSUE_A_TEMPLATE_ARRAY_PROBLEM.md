# Issue A: Command Template Not Being Applied - List Template Incorrectly Repeated

## Problem Description

When executing the following command:
```bash
./frontmatter-to-schema .agent/test-climpt/prompts \
  --schema=.agent/test-climpt/registry_schema.json \
  --template=.agent/test-climpt/registry_template.json \
  --destination=.agent/test-climpt/registed-commands.json \
  --verbose
```

The command executes successfully, but the output file (`registed-commands.json`) incorrectly uses the list template repeatedly instead of properly formatting individual commands using the command template array structure.

## Expected Behavior

The output should use the command template to format individual command objects within an array structure, as defined in the template file.

## Actual Behavior

The list template is being repeated for each item instead of using the command template, resulting in incorrect JSON structure.

## Impact

This prevents proper generation of command registry files, making the tool unable to correctly format command arrays according to the specified template.

## Investigation Status

- [ ] Reproduce the issue
- [ ] Analyze the actual output
- [ ] Review template mapper implementation
- [ ] Identify root cause
- [ ] Document findings

## Root Cause Analysis

### The Problem
The system is applying the parent template to each document individually, resulting in repeated list template structures instead of properly populating the `commands` array with command templates.

### Current Flow
1. Each markdown document is processed individually through `processDocument()` method
2. The `TemplateMapper.map()` applies the full parent template to each document's frontmatter data
3. Each document produces a complete template structure (with empty `availableConfigs` array)
4. The `ResultAggregator.aggregate()` collects all individual results into a simple `{ results: [...] }` wrapper
5. This creates 28 identical parent template structures instead of one parent with 28 command items

### Key Code Issues

#### 1. TemplateMapper (src/domain/services/template-mapper.ts)
- Applies the entire template structure to each document's data
- No support for array item templates or `$ref` references to sub-templates
- Lines 211-293: `applyDataToTemplateStrict()` doesn't handle template references

#### 2. AggregatedResult (src/domain/models/entities.ts:486)
```typescript
toOutput(): string {
  const data = this.results.map((r) => r.getMappedData().getData());
  if (this.format === "json") {
    return JSON.stringify({ results: data }, null, 2);
  }
  // ...
}
```
- Simply wraps all individual results in `{ results: [...] }`
- Doesn't consider that documents might be array items within a parent structure

#### 3. Process Flow (src/application/use-cases/process-documents.ts)
- Lines 327-518: Each document is processed independently
- Line 447: Results are aggregated as separate complete structures
- No concept of documents being array items within a parent template

### Expected Behavior vs Actual
**Expected:**
```json
{
  "version": "1.0.0",
  "description": "Climpt Command Registry",
  "tools": {
    "availableConfigs": ["git", "spec", "test", ...],
    "commands": [
      { "c1": "spec", "c2": "analyze", "c3": "quality-metrics", ... },
      { "c1": "meta", "c2": "resolve", "c3": "registered-commands", ... },
      // ... 26 more command objects
    ]
  }
}
```

**Actual:**
```json
{
  "results": [
    {
      "version": "1.0.0",
      "description": "Climpt Command Registry",
      "tools": { "availableConfigs": [] }
    },
    // ... repeated 27 more times
  ]
}
```

### Missing Features
1. **Template Reference Resolution**: The system doesn't handle `"$ref": "registry_command_template.json"` in templates
2. **Array Item Templates**: No support for specifying different templates for array items vs parent structure
3. **Document-to-Array Mapping**: No mechanism to map multiple documents into a single array field
4. **Aggregation Strategy**: The aggregator doesn't understand template structure relationships

## Affected Components

- Template Mapper Service
- Schema Processing Logic
- Array/List Template Handling

## Priority

High - Core functionality is broken for array template processing