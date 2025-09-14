# Climpt Registry Example - x-* Properties Demonstration

This example demonstrates the use of x-* extension properties in the
frontmatter-to-schema tool.

## x-* Properties Used

### 1. x-template

- **Location**: `schema.json` (line 3), `command-schema.json` (line 3)
- **Purpose**: Specifies the template file to use for rendering the output
- **Example**: `"x-template": "./template.json"`

### 2. x-derived-from

- **Location**: `schema.json` (lines 19, 26, 32, 38)
- **Purpose**: Aggregates values from specified paths in the frontmatter data
- **Examples**:
  - `"x-derived-from": "commands[].c1"` - Extracts all c1 values from commands
    array
  - `"x-derived-from": "commands[].c2"` - Extracts all c2 values from commands
    array
  - `"x-derived-from": "commands[].c3"` - Extracts all c3 values from commands
    array

### 3. x-derived-unique

- **Location**: `schema.json` (lines 20, 27, 33, 39)
- **Purpose**: Ensures only unique values are kept when used with x-derived-from
- **Example**: `"x-derived-unique": true`

### 4. x-frontmatter-part

- **Location**: `schema.json` (line 44)
- **Purpose**: Marks array properties that should be extracted from frontmatter
- **Example**: `"x-frontmatter-part": true`

## How It Works

1. **Template Chain Resolution**:
   - Main schema references `template.json`
   - Commands array items reference `command-schema.json`
   - Command schema references `command-template.json`

2. **Data Aggregation**:
   - `availableConfigs`: Automatically populated with unique c1 values from all
     commands
   - `allC1Categories`: All unique domain/category values
   - `allC2Actions`: All unique action/directive values
   - `allC3Targets`: All unique target/layer values

3. **Array Processing**:
   - Commands array marked with `x-frontmatter-part` for proper extraction
   - Each command processed according to `command-schema.json`

## Running the Example

```bash
# Process the climpt registry markdown files
deno run --allow-all src/cli.ts \
  examples/climpt-registry/schema.json \
  output/climpt-registry.json \
  '.agent/climpt/prompts/**/*.md'
```

## Expected Output Structure

```json
{
  "version": "1.0.0",
  "description": "Climpt comprehensive configuration",
  "tools": {
    "availableConfigs": ["git", "spec", "test", "code", "docs", "meta"],
    "allC1Categories": ["git", "spec", "test", "code", "docs", "meta"],
    "allC2Actions": ["create", "analyze", "execute", "update"],
    "allC3Targets": ["refinement-issue", "quality-metrics", "coverage"],
    "commands": [
      {
        "c1": "git",
        "c2": "create",
        "c3": "refinement-issue",
        "description": "Creates a git refinement issue",
        "usage": "climpt-git create refinement-issue",
        "options": {...}
      }
    ]
  }
}
```

## Benefits of x-* Properties

1. **No Manual Aggregation**: The `availableConfigs` array is automatically
   populated from commands
2. **DRY Principle**: No need to manually maintain lists of categories, actions,
   or targets
3. **Template Flexibility**: Templates can be chained and reused
4. **Type Safety**: Schema validation ensures data consistency
5. **Automatic Deduplication**: `x-derived-unique` prevents duplicate values
