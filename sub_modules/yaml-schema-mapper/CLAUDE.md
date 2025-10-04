# Sub-module: yaml-schema-mapper

## Branching Rules

This sub-module follows a strict branching strategy:

### Branch Pattern

```
sub_module/yaml-schema-mapper/<type>/<description>
```

### Branch Types

- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test additions or improvements

### Examples

```
sub_module/yaml-schema-mapper/feature/property-mapping
sub_module/yaml-schema-mapper/fix/type-coercion-bug
sub_module/yaml-schema-mapper/refactor/validator-cleanup
```

### Merge Strategy

1. All changes MUST be merged into `develop` first
2. Sub-module branches MUST be created from `develop`
3. Never merge sub-module branches directly to `main`
4. Follow parent project's Git workflow

### Module Independence

- This module has ZERO dependencies on the parent project
- All imports must be self-contained or from standard libraries
- Use the local Result type (./src/result.ts), not the parent's
