# Spec-Trace Documentation Example

This example demonstrates multi-level documentation processing with spec-trace
functionality.

## Files Structure

### Schema Files

- `index_req_schema.json` - Requirements level schema
- `index_spec_schema.json` - Specification level schema
- `index_design_schema.json` - Design level schema
- `index_impl_schema.json` - Implementation level schema
- `index_test_schema.json` - Test level schema

### Template Files

- `index_level_template.json` - Main index template for all levels
- `index_req_template.json` - Requirements level specific template
- `index_spec_template.json` - Specification level specific template
- `index_design_template.json` - Design level specific template
- `index_impl_template.json` - Implementation level specific template
- `index_test_template.json` - Test level specific template

### Documentation

- `docs/` - Contains markdown files with frontmatter for each spec-trace level

## Processing Script

### process-spec-trace-levels.sh

Processes all spec-trace levels (req, spec, design, impl, test) in sequence.

**Usage:**

```bash
cd /path/to/frontmatter-to-schema
./examples/3.docs/process-spec-trace-levels.sh
```

**What it does:**

1. Changes to `.agent/spec-trace/` directory
2. Processes each level (req, spec, design, impl, test) using:
   - Schema: `index_{level}_schema.json`
   - Output: `index/{level}_index.json`
   - Input: `docs/**/*.md`
3. Returns to the original directory

**Expected Output:**

- `index/req_index.json`
- `index/spec_index.json`
- `index/design_index.json`
- `index/impl_index.json`
- `index/test_index.json`

## Features Demonstrated

- **Multi-level processing**: Different schemas for different documentation
  levels
- **Hierarchical filtering**: Each level filters relevant frontmatter data
- **Template inheritance**: Shared templates with level-specific customization
- **Batch processing**: Single script processes all levels automatically

## Notes

- This example works with the `.agent/spec-trace/` directory structure
- Make sure the spec-trace documentation exists before running the script
- The script uses `--verbose` flag for detailed output
