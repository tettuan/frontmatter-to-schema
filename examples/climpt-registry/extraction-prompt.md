# Extraction Prompt for Climpt Registry

Extract command information from the markdown frontmatter.

## Instructions

1. Parse the frontmatter to identify the C3L command structure
2. Extract the command components (c1, c2, c3)
3. Extract the description and usage information
4. Extract any options or parameters

## Expected Output Format

Return a JSON object with the following structure:
```json
{
  "c1": "domain/category (e.g., git, spec, test, code, docs, meta)",
  "c2": "action/directive (e.g., create, analyze, execute)",
  "c3": "target/layer (e.g., refinement-issue, quality-metrics)",
  "description": "Command description",
  "usage": "Usage instructions and examples",
  "options": {
    "input": ["MD", "JSON"],
    "adaptation": ["default", "detailed"],
    "input_file": [true],
    "stdin": [false],
    "destination": [true]
  }
}
```

If any field is not present in the frontmatter, omit it from the output.