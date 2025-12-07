# docs/ Directory Instructions

This is a Claude Code instruction file for the `docs/` directory.

## Directory Purpose

This directory contains project documentation. When working here:

- **Read before editing**: Understand existing documentation structure
- **Maintain consistency**: Follow established patterns and conventions
- **Cross-reference**: Update related documents when making changes

## Key Documentation

### User-Facing (Public)

- `concepts/transformation-model.md` - Core x-* directive concept
- `guides/directive-selection.md` - Directive selection guide
- `schema-extensions.md` - Complete directive reference
- `troubleshooting.md` - Common issues and debugging

### Architecture (Internal)

- `architecture/` - System design and specifications
- `development/` - Development principles (ai-complexity-control, totality)
- `tests/` - Testing strategy and guidelines

## Documentation Language

- **Primary**: English
- **Japanese files**: Suffix with `.ja.md`

## When Editing Documentation

1. Check for related documents that may need updates
2. Maintain cross-references between documents
3. Keep examples consistent with actual implementation
4. Run `deno fmt` after editing markdown files
