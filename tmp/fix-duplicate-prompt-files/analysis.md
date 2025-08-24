# Duplicate Prompt Files Analysis

## Potential Duplicates Found:

### Group 1: Frontmatter extraction

- ./scripts/prompts/extract_frontmatter.md
- ./src/infrastructure/prompts/extract-information.md
- ./src/prompts/extract-information.md

### Group 2: Schema/Template mapping

- ./scripts/prompts/map_to_schema.md
- ./src/infrastructure/prompts/map-to-template.md
- ./src/prompts/map-to-template.md

## Analysis Results:

## Detailed Analysis

### Frontmatter Extraction Duplicates

1. **scripts/prompts/extract_frontmatter.md** - Japanese climpt-specific prompt
   for analyzing prompt files
2. **src/prompts/extract-information.md** - Generic English frontmatter
   extraction for any schema
3. **src/infrastructure/prompts/extract-information.md** - Infrastructure layer
   specific, placeholder-based

### Template/Schema Mapping Duplicates

1. **scripts/prompts/map_to_schema.md** - Japanese climpt registry schema
   mapping
2. **src/prompts/map-to-template.md** - Generic English template mapping
3. **src/infrastructure/prompts/map-to-template.md** - Infrastructure layer
   specific

## Consolidation Recommendations

Following DDD principles and the Totality principle:

### 1. Domain Layer (src/domain/prompts/)

Create canonical prompts that are:

- Domain-focused
- Language-consistent (English for code, Japanese for docs per project
  standards)
- Total functions (handle all cases, no partial functions)

### 2. Infrastructure Layer (src/infrastructure/prompts/)

Keep only infrastructure-specific adaptations

### 3. Remove Redundant Locations

- Remove scripts/prompts/ (non-DDD compliant)
- Consolidate src/prompts/ into domain layer

## Files to Remove/Consolidate
