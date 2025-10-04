# Property Name Mismatch Example

This example demonstrates why template expansion with `{options.input_file}` fails for certain data.

## Root Cause

The json-template processor requires **exact property name matches**. When a template references a property that doesn't exist in the data, it throws a `VariableNotFoundError`.

## Test Cases

### Case 1: SUCCESS - Data has matching property

**Data**: `data_with_input_file.json`
```json
{
  "options": {
    "input_file": true  // Property exists
  }
}
```

**Template**: `template_fail.json` (references `{options.input_file}`)

**Result**: ✓ SUCCESS - Template expands correctly

**Test**:
```bash
deno run --allow-read sub_modules/json-template/src/mod.ts \
  examples/test-property-mismatch/data_with_input_file.json \
  examples/test-property-mismatch/template_fail.json
```

### Case 2: FAILURE - Data has different property name

**Data**: `data_with_file.json`
```json
{
  "options": {
    "file": true  // Property is "file", not "input_file"
  }
}
```

**Template**: `template_fail.json` (references `{options.input_file}`)

**Result**: ✗ FAILURE - Variable not found: options.input_file

**Test**:
```bash
deno run --allow-read sub_modules/json-template/src/mod.ts \
  examples/test-property-mismatch/data_with_file.json \
  examples/test-property-mismatch/template_fail.json
```

### Case 3: SUCCESS - Template only references existing properties

**Data**: `data_with_file.json`

**Template**: `template_success.json` (references `{options}` as a whole)

**Result**: ✓ SUCCESS - Template expands correctly with the entire options object

**Test**:
```bash
deno run --allow-read sub_modules/json-template/src/mod.ts \
  examples/test-property-mismatch/data_with_file.json \
  examples/test-property-mismatch/template_success.json
```

## Analysis

### Why `options_each` pattern fails

The template pattern:
```json
{
  "options": "{options}",
  "options_each": {
    "input": "{options.input}",
    "input_file": "{options.input_file}"
  }
}
```

**Fails when**:
- Data has `options.file` but template expects `options.input_file`
- Data has `options.input` array but template expects it in all records
- Any referenced property is missing from the data

### Solutions

1. **Standardize property names**: Ensure all data sources use consistent property names
   - Use `input_file` everywhere, OR
   - Use `file` everywhere

2. **Use object expansion**: Reference the entire object instead of individual properties
   ```json
   {
     "options": "{options}"
   }
   ```

3. **Data validation**: Validate data against schema before template processing

4. **Data transformation**: Add a pre-processing step to normalize property names

## Real-world Context

In the `examples/2.climpt/test-simple.json` file:
- 11 commands use `options.file`
- 2 commands use `options.input_file`

This inconsistency means:
- A template with `{options.input_file}` will fail for 11/13 commands
- A template with `{options.file}` will fail for 2/13 commands
- A template with `{options}` will work for all 13 commands
