# Correct Output Based on Current Templates

## Important: Template Principle

**The template defines the EXACT output. Only what is written in the template
will be output.**

## Current Template Situation

The file `traceability_item_template.json` contains only:

```json
"{id.full}"
```

This means the output will be **string values only**, not full objects.

## Correct Output Files

Based on the current template (`"{id.full}"` only), the correct output files
are:

### success_req_index_correct.json

```json
{
  "version": "1.0.0",
  "description": "Requirement level traceability IDs",
  "req": [
    "req:api:deepresearch-3f8d2a#20250909",
    "req:ui:dashboard-5b7c9e#20250910",
    "req:data:validation-2a4f8d#20250911"
  ]
}
```

Note: `req` array contains **strings**, not objects.

### success_spec_index_correct.json

```json
{
  "version": "1.0.0",
  "description": "Specification level traceability IDs",
  "spec": [
    "spec:api:auth-module-7e9c2f#20250910",
    "spec:ui:responsive-grid-4d3a8b#20250911",
    "spec:data:cache-layer-9f5e1c#20250912"
  ]
}
```

### success_design_index_correct.json

```json
{
  "version": "1.0.0",
  "description": "Design level traceability IDs",
  "design": [
    "design:api:rest-architecture-6b4e9a#20250912",
    "design:ui:component-library-2c7f5d#20250913",
    "design:data:schema-design-8a1b3e#20250914"
  ]
}
```

### success_impl_index_correct.json

```json
{
  "version": "1.0.0",
  "description": "Implementation level traceability IDs",
  "impl": [
    "impl:api:auth-service-3d8f2c#20250914",
    "impl:ui:dashboard-view-9e2a7b#20250915",
    "impl:data:repository-layer-5c4d1f#20250916"
  ]
}
```

### success_test_index_correct.json

```json
{
  "version": "1.0.0",
  "description": "Test level traceability IDs",
  "test": [
    "test:api:integration-tests-7f3b8e#20250916",
    "test:ui:e2e-scenarios-4a9c2d#20250917",
    "test:data:unit-tests-1e6f5b#20250918"
  ]
}
```

## If You Want Full Objects

If you need the output to contain full objects (with id, summary, description,
status), you must update `traceability_item_template.json` to:

```json
{
  "id": {
    "full": "{id.full}",
    "level": "{id.level}",
    "scope": "{id.scope}",
    "semantic": "{id.semantic}",
    "hash": "{id.hash}",
    "version": "{id.version}"
  },
  "summary": "{summary}",
  "description": "{description}",
  "status": "{status}"
}
```

Only then will the output contain complete objects instead of simple strings.

## Key Points

1. **Template Authority**: The template file is the sole authority for output
   format
2. **No Schema Inference**: Schema does NOT affect output structure
3. **Explicit Definition**: You must explicitly define every field you want in
   the output
4. **Current State**: With `"{id.full}"` template, outputs are string arrays,
   not object arrays
