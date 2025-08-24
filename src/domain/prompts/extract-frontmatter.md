Extract the following frontmatter data according to the provided schema.

FrontMatter:
{{FRONTMATTER}}

Schema:
{{SCHEMA}}

Instructions:
1. Parse the frontmatter YAML data
2. Extract fields that match the schema
3. Return ONLY a valid JSON object containing the extracted data
4. The JSON should directly map to the schema structure
5. Use null for missing required fields
6. Ignore extra fields not in the schema

Return your response as a single JSON object with no additional text or explanation.
