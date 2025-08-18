# Frontmatter Information Extraction

You are tasked with extracting structured information from a YAML frontmatter to
identify C3L (Command-Category-Layer) commands for the Climpt registry.

## Input Data

### Frontmatter Content:

{{frontmatter}}

### Target Schema Definition:

{{schema}}

## Task

Analyze the frontmatter and extract information that maps to the C3L command
structure:

- **c1**: The domain/category (e.g., git, spec, test, code, docs, meta)
- **c2**: The action/directive (e.g., create, analyze, execute, validate)
- **c3**: The target/layer (e.g., refinement-issue, quality-metrics,
  integration-suite)

## Extraction Rules

1. Look for explicit command definitions in the frontmatter
2. Identify the domain from tags, categories, or explicit domain fields
3. Extract actions from verbs in titles, descriptions, or action fields
4. Determine targets from object references, file types, or target fields
5. Parse any usage examples or documentation
6. Identify supported options (input formats, modes, flags)

## Output Format

Return a JSON array of extracted command information:

```json
[
  {
    "c1": "domain",
    "c2": "action",
    "c3": "target",
    "description": "extracted or inferred description",
    "usage": "usage information if available",
    "options": {
      "input": ["format1", "format2"],
      "adaptation": ["mode1", "mode2"],
      "input_file": [true/false],
      "stdin": [true/false],
      "destination": [true/false]
    }
  }
]
```

## Important Notes

- If multiple commands are detected, return all of them
- If no clear command structure is found, return an empty array
- Infer missing information from context when possible
- Preserve original descriptions and usage text when available
- Options are optional and should only be included if explicitly mentioned
