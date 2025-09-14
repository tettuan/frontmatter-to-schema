# Test Scripts

This directory contains test scripts for validating the frontmatter-to-schema functionality.

## Scripts

### test-climpt-registry.sh

Tests the legacy CLI interface with climpt-registry example.

**Usage:**
```bash
cd /path/to/frontmatter-to-schema
./examples/4.test-scripts/test-climpt-registry.sh
```

**Configuration:**
- Schema: `./examples/climpt-registry/schema.json`
- Template: `./examples/climpt-registry/template.json`
- Input: `./.agent/climpt/prompts`
- Output: `./tmp/test-output.json`

### test-frontmatter-to-schema.sh

Tests the new CLI interface with improved argument handling.

**Usage:**
```bash
cd /path/to/frontmatter-to-schema
./examples/4.test-scripts/test-frontmatter-to-schema.sh
```

**Configuration:**
- Schema: `./examples/2.climpt/registry_schema.json`
- Input Pattern: `./.agent/climpt/prompts/**/*.md`
- Output: `./tmp/test-output.json`

## Exit Codes

Both scripts return:
- `0`: Success
- `2`: Expected failure or controlled exit

## Notes

- These scripts are primarily used for CI/CD validation
- Make sure to run them from the project root directory
- The `tmp/` directory will be created if it doesn't exist