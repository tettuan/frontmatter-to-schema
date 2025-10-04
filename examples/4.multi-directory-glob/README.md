# Multi-Directory Glob Pattern Example

This example demonstrates processing files across multiple subdirectories using
glob patterns.

## Structure

```
docs/
├── frontend/
│   └── component.md
├── backend/
│   └── database.md
└── api/
    └── rest-api.md
```

## Issue Reproduction

This example reproduces issue #1285 where glob patterns spanning multiple
directories fail.

### Expected Behavior

```bash
# Should process all 3 files from different subdirectories
frontmatter-to-schema schema.json output.json docs/**/*.md --verbose
```

Expected output:

```json
{
  "total": 3,
  "documents": [...],
  "categories": ["frontend", "backend", "api"]
}
```

### Current Behavior (Bug)

```bash
frontmatter-to-schema schema.json output.json docs/**/*.md --verbose
# ❌ No valid documents found in directory
```

The CLI finds common parent `docs/` but since there are no `.md` files directly
in `docs/`, it reports no documents found.

### Workaround

Use directory path directly:

```bash
frontmatter-to-schema schema.json output.json docs/ --verbose
# ✅ Works - recursively processes all subdirectories
```

## Related

- Issue: #1285
- Code: `src/presentation/cli/index.ts:154-181`
