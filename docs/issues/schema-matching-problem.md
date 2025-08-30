# Issue: Schema Matching Not Working Correctly for Registry Commands

## Problem Summary
The `frontmatter-to-schema` command is not correctly processing frontmatter data according to the schema and template requirements specified in `docs/requirements.ja.md`. The output structure does not match the expected format defined by `registry_schema.json` and `registry_command_template.json`.

## Current Behavior

### Command Executed
```bash
./frontmatter-to-schema .agent/test-climpt/prompts \
  --schema=.agent/test-climpt/registry_schema.json \
  --template=.agent/test-climpt/registry_template.json \
  --destination=.agent/test-climpt/registed-commands.json \
  --verbose
```

### Actual Output Structure
```json
{
  "version": "1.0.0",
  "description": "Generic Data Registry",
  "tools": {
    "availableConfigs": [],
    "commands": [
      {
        "ok": true,
        "data": {
          "version": "1.0.0",
          "description": "...",
          "tools": {
            "availableConfigs": []
          }
        }
      }
    ]
  }
}
```

## Expected Behavior

### Expected Output Structure (per registry_command_template.json)
```json
{
  "version": "1.0.0",
  "description": "Registry description",
  "tools": {
    "availableConfigs": ["spec", "git", "build", "..."],
    "commands": [
      {
        "c1": "spec",
        "c2": "analyze",
        "c3": "quality-metrics",
        "title": "Analyze Specification Quality",
        "description": "Analyze specification quality and completeness metrics",
        "usage": "climpt-spec analyze quality-metrics -f spec.md -o report.json",
        "options": {
          "input": null,
          "adaptation": null,
          "file": [true],
          "stdin": null,
          "destination": [true]
        }
      }
    ]
  }
}
```

## Identified Problems

### 1. Missing C1/C2/C3 Fields in Commands Array
- **Problem**: The commands array contains objects with `{"ok": true, "data": {...}}` structure instead of the actual command fields
- **Expected**: Each command should have `c1`, `c2`, `c3`, `title`, `description`, `usage`, and `options` fields
- **Impact**: Commands cannot be identified or executed properly

### 2. Incorrect Data Nesting
- **Problem**: Each command is wrapped in an extra layer with `ok` and `data` fields
- **Expected**: Commands should be directly in the array without wrapper objects
- **Impact**: The structure doesn't match the schema definition

### 3. Empty availableConfigs Array
- **Problem**: The `tools.availableConfigs` array is empty
- **Expected**: Should contain unique values from all `c1` fields (e.g., ["spec", "git", "build", "meta", "docs", "refactor", "debug", "design"])
- **Impact**: Available tools cannot be properly registered

### 4. Wrong Field Values in Nested Data
- **Problem**: The nested `data` objects contain `version`, `description`, and `tools` fields
- **Expected**: These fields should only exist at the root level, not in individual commands
- **Impact**: Command structure is completely wrong

### 5. Missing Options Field Processing
- **Problem**: The `options` field from frontmatter is not being properly extracted and formatted
- **Expected**: Options should include `input`, `adaptation`, `file`, `stdin`, `destination` fields
- **Impact**: Command options are not available for execution

## Root Cause Analysis

The schema matching logic appears to be:
1. Not correctly extracting frontmatter fields (c1, c2, c3, etc.)
2. Wrapping results in an unnecessary Result type structure
3. Not applying the command template correctly
4. Not aggregating c1 values for availableConfigs

## ToDo List for Fixes

### Phase 1: Core Schema Matching Fix
- [ ] Fix frontmatter extraction to properly get c1, c2, c3 fields
- [ ] Remove the Result wrapper (`ok`/`data`) from command array items
- [ ] Apply registry_command_template.json correctly to each command

### Phase 2: Field Mapping Implementation
- [ ] Map frontmatter fields to template placeholders correctly
- [ ] Handle optional fields (set to null when not present)
- [ ] Process options field array values properly

### Phase 3: AvailableConfigs Generation
- [ ] Extract all unique c1 values from processed commands
- [ ] Populate tools.availableConfigs array with unique c1 values
- [ ] Sort availableConfigs alphabetically

### Phase 4: Template Application
- [ ] Implement proper template substitution for registry_template.json
- [ ] Implement proper template substitution for registry_command_template.json
- [ ] Handle nested field references (e.g., `{options.input}`)

### Phase 5: Testing & Validation
- [ ] Create unit tests for schema matching
- [ ] Create integration tests with sample frontmatter files
- [ ] Validate output against JSON schema
- [ ] Test with the actual .agent/test-climpt/prompts directory

## Technical Implementation Details

### Current Processing Flow (Incorrect)
1. Extract frontmatter → Gets data
2. AI Analysis → Returns wrapped result
3. Template application → Applies incorrectly
4. Output → Wrong structure

### Required Processing Flow
1. Extract frontmatter from each markdown file
2. Map frontmatter to command schema structure
3. Collect all commands
4. Extract unique c1 values for availableConfigs
5. Apply registry_template.json with collected data
6. Output correct JSON structure

## References
- Requirements: `docs/requirements.ja.md`
- Schema: `.agent/test-climpt/registry_schema.json`
- Command Schema: `.agent/test-climpt/registry_command_schema.json`
- Template: `.agent/test-climpt/registry_template.json`
- Command Template: `.agent/test-climpt/registry_command_template.json`
- Example Output: `.agent/test-climpt/example-registed_commands.json`

## Priority
**High** - This is a core functionality requirement that blocks proper command registry generation

## Labels
- bug
- schema-matching
- core-functionality
- high-priority