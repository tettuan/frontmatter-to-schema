# Climpt Registry Example

This example demonstrates processing climpt prompts into a registry format using
the frontmatter-to-schema tool.

## Files Structure

### Schema Files

- `registry_schema.json` - Main registry schema
- `registry_command_schema.json` - Individual command schema

### Template Files

- `registry_template.json` - Main registry template with {@items} expansion
- `registry_command_template.json` - Individual command template

### Data Source

- `prompts/` - Contains markdown files with frontmatter for climpt commands
- Input source: `./.agent/climpt/prompts/**/*.md`

## Running the Example

### run.sh

Processes all climpt prompts and generates a registry.

**Usage:**

```bash
cd /path/to/frontmatter-to-schema
./examples/2.climpt/run.sh
```

**What it does:**

1. Uses `registry_schema.json` to define the expected structure
2. Processes all `.md` files in `.agent/climpt/prompts/`
3. Generates a unified registry at `./tmp/climpt-registry-output.json`
4. Shows summary information about the generated registry

**Expected Output:**

```json
{
  "version": "1.0.0",
  "description": "Climpt command registry",
  "commands": [
    {
      "name": "build",
      "c1": "build"
      // ... other command properties
    }
    // ... more commands
  ],
  "availableConfigs": ["build", "debug", "design"] // derived from commands
}
```

## Features Demonstrated

- **Array expansion**: Uses `{@items}` for command list generation
- **Derived fields**: `availableConfigs` is derived from `commands[].c1`
- **Schema validation**: Ensures all commands follow the defined structure
- **Template variable replacement**: Schema defaults are populated

## Schema Extensions Used

- `x-frontmatter-part: true` - Processes each markdown file as a separate
  command
- `x-derived-from: "commands[].c1"` - Creates derived availableConfigs array
- `x-derived-unique: true` - Removes duplicates from derived array

## Notes

- This example requires `.agent/climpt/prompts/` directory with markdown files
- Each markdown file should have proper frontmatter with command definitions
- The `tmp/` directory will be created automatically if it doesn't exist
