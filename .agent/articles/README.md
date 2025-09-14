# Article Index Generator

This directory contains Schema and template files for generating an article
index from markdown files with frontmatter.

## Files

### Schema Files

- `articles_schema.json` - Main schema for the article index
- `article_schema.json` - Schema for individual article entries

### Template Files

- `articles_template.yml` - Main template for the index output
- `article_template.yml` - Template for individual article entries

## Processing Flow

1. **Input**: Markdown files in `./docs/` directory
2. **Extraction**: Frontmatter data from each markdown file
3. **Schema Processing**:
   - Apply `article_schema.json` to each article
   - Aggregate into `articles_schema.json` structure
4. **Template Rendering**:
   - Use `article_template.yml` for each article
   - Combine using `articles_template.yml` for final output
5. **Output**: YAML file with article index

## Special Attributes

- `x-frontmatter-part`: Marks the articles array for frontmatter processing
- `x-derived-from`: Aggregates values from articles
- `x-derived-unique`: Ensures unique values in aggregated arrays
- `x-derived-count`: Counts matching items
- `x-template`: Specifies which template to use

## Expected Frontmatter Format

```yaml
---
title: "Article Title"
emoji: "📝"
type: "tech" # or "idea"
topics: [topic1, topic2]
published: true
published_at: "2025-01-15 10:00"
---
```

## Output Format

The generated index will include:

- Metadata (generation time, counts)
- Complete article list with all properties
- Aggregated topics and types lists
