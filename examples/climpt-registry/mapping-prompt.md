# Mapping Prompt for Climpt Registry

Map the extracted command data to the registry schema format.

## Instructions

1. Take the extracted command data
2. Ensure it conforms to the registry schema
3. Add default values for missing optional fields
4. Validate that all required fields are present

## Schema Requirements

The output must match this schema structure:

- c1: string (required) - Domain/category
- c2: string (required) - Action/directive
- c3: string (required) - Target/layer
- description: string (required) - Command description
- usage: string (optional) - Usage instructions
- options: object (optional) - Command options

## Output Format

Return a valid JSON object that matches the schema exactly.
