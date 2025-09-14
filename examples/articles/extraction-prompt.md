# Extraction Prompt for Articles Index

Extract article metadata from the markdown frontmatter.

## Instructions

1. Parse the frontmatter to identify article metadata
2. Extract title, type, and publication status
3. Extract topics/tags if present
4. Extract emoji and publication date if available

## Expected Output Format

Return a JSON object with the following structure:

```json
{
  "title": "Article title",
  "emoji": "📚",
  "type": "tech|idea|tutorial|other",
  "topics": ["tag1", "tag2", "tag3"],
  "published": true,
  "published_at": "2025-08-01 10:00"
}
```

## Field Mappings

Common frontmatter field variations to look for:

- Title: title, name, heading
- Type: type, category, kind
- Topics: topics, tags, keywords, categories
- Published: published, draft, status
- Date: published_at, date, created_at, updated_at
- Emoji: emoji, icon

If a field is not present, use these defaults:

- emoji: "📚"
- type: "tech"
- published: false
- topics: []
