# Mapping Prompt for Articles Index

Map the extracted article data to the books schema format.

## Instructions

1. Take the extracted article metadata
2. Ensure it conforms to the books schema
3. Apply default values for missing fields
4. Format dates consistently

## Schema Requirements

The output must be an object with a "books" array containing items with:

- title: string (required) - Article title
- emoji: string - Emoji icon (default: "📚")
- type: string (required) - Article type
- topics: array of strings - Topic tags
- published: boolean (required) - Publication status
- published_at: string - Publication date in "YYYY-MM-DD HH:mm" format

## Transformations

1. If emoji is missing, use "📚"
2. If published_at is missing, use current date
3. Ensure topics is always an array (empty if no topics)
4. Convert boolean strings to actual booleans for published field

## Output Format

Return a valid JSON object with a "books" array containing the article data.
