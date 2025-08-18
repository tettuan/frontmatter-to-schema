# Map Extracted Information to Registry Schema

You are tasked with mapping extracted command information to the formal Climpt
registry schema format.

## Input Data

### Extracted Information:

{{extracted}}

### Original Frontmatter:

{{frontmatter}}

### Target Schema:

{{schema}}

## Task

Transform the extracted command information into the exact registry schema
format. Ensure all commands are properly structured with required fields and
valid option configurations.

## Mapping Rules

1. **Required Fields**: Every command must have c1, c2, c3, and description
2. **Optional Fields**: usage and options are optional but should be included
   when available
3. **Validation**:
   - c1 should be one of: git, spec, test, code, docs, meta (or other valid
     domains)
   - c2 should be a clear action verb
   - c3 should identify the specific target or layer
4. **Options Structure**:
   - input: Array of supported input formats (e.g., ["MD", "JSON", "YAML"])
   - adaptation: Array of processing modes (e.g., ["default", "detailed",
     "minimal"])
   - input_file: Array with single boolean indicating file input support
   - stdin: Array with single boolean indicating standard input support
   - destination: Array with single boolean indicating output destination
     support

## Output Format

Return a JSON object containing the properly formatted commands:

```json
{
  "commands": [
    {
      "c1": "domain",
      "c2": "action",
      "c3": "target",
      "description": "Clear description of the command",
      "usage": "Usage instructions with examples",
      "options": {
        "input": ["format1", "format2"],
        "adaptation": ["mode1", "mode2"],
        "input_file": [true],
        "stdin": [false],
        "destination": [true]
      }
    }
  ]
}
```

## Processing Guidelines

1. Preserve the semantic meaning from the extracted information
2. Ensure descriptions are clear and concise
3. Format usage text to be helpful and include examples when possible
4. Only include options that were explicitly identified or strongly implied
5. Maintain consistency in naming conventions across similar commands
6. If no valid commands can be mapped, return: `{"commands": []}`

## Quality Checks

- Verify all required fields are present
- Ensure c1/c2/c3 follow naming conventions (lowercase, hyphen-separated)
- Check that boolean arrays in options contain exactly one value
- Validate that descriptions provide value to users
