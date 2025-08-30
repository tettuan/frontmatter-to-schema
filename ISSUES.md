# Identified Issues in FrontMatter-to-Schema Implementation

Based on analysis of requirements (`docs/requirements.ja.md`) and current
implementation, the following critical issues have been identified:

## Issue #1: CLI Argument Parsing Does Not Support Positional Arguments

### Problem

The current CLI implementation in `src/main.ts` expects named arguments like
`--documents`, but the intended usage pattern from requirements uses positional
arguments:

```bash
./frontmatter-to-schema .agent/test-climpt/prompts --schema=... --template=...
```

### Current Behavior

- CLI expects: `--documents .agent/test-climpt/prompts`
- Requirements expect: `.agent/test-climpt/prompts` (positional)

### Impact

Users cannot execute the CLI as documented in requirements.

### Solution

Modify `src/main.ts` to:

1. Accept positional arguments for the documents path
2. Maintain backward compatibility with `--documents` flag

---

## Issue #2: Missing Two-Stage Processing Pipeline

### Problem

Requirements specify a two-stage processing architecture:

1. **Stage 1**: Process individual markdown files with command schema/template
2. **Stage 2**: Aggregate results into registry structure

Current implementation only supports single-stage processing.

### Current Behavior

- Single pass through documents
- Direct mapping to final output
- No intermediate aggregation step

### Expected Behavior (from requirements)

```
Stage 1: markdown → command_schema → command_template → command objects
Stage 2: command objects → registry_schema → registry_template → final registry
```

### Impact

- Cannot generate proper registry structure with `availableConfigs`
- Cannot handle command-level and registry-level schemas separately

### Solution

Implement a two-stage pipeline:

1. Add `ProcessingStage` enum in domain
2. Create `TwoStageProcessor` use case
3. Support intermediate result storage

---

## Issue #3: c1/c2/c3 Field Extraction Not Working

### Problem

The `TypeScriptAnalyzer` doesn't properly extract c1/c2/c3 fields from
frontmatter, which are critical for command categorization.

### Current Behavior

- Fields exist in frontmatter (verified in
  `.agent/test-climpt/prompts/git/create/refinement-issue/f_default.md`)
- TypeScriptAnalyzer passes through raw data without extracting these fields
- Template substitution fails for `{c1}`, `{c2}`, `{c3}` placeholders

### Expected Behavior

```yaml
# Input frontmatter
c1: git
c2: create
c3: refinement-issue

# Output JSON
{
  "c1": "git",
  "c2": "create", 
  "c3": "refinement-issue"
}
```

### Impact

- Command categorization broken
- Template placeholders remain unsubstituted
- `availableConfigs` cannot be generated

### Solution

1. Modify `TypeScriptAnalyzer.analyze()` to explicitly extract c1/c2/c3
2. Ensure ExtractedData contains these fields
3. Update template mapper to handle these fields

---

## Issue #4: Template Placeholder Substitution Not Implemented

### Problem

Template placeholders like `{c1}`, `{options.input}` are not being replaced with
actual values.

### Current Behavior

- Template contains: `"c1": "{c1}"`
- Output contains: `"c1": "{c1}"` (literal string)

### Expected Behavior

- Template contains: `"c1": "{c1}"`
- Output contains: `"c1": "git"` (substituted value)

### Impact

- Output files contain template placeholders instead of data
- Schema validation fails due to incorrect types

### Solution

1. Implement `PlaceholderSubstitutor` in domain/template
2. Add substitution logic to `TemplateMapper`
3. Support nested path resolution (e.g., `{options.input}`)

---

## Issue #5: Missing Registry Aggregation Logic

### Problem

No implementation for aggregating multiple command results into a registry
structure with `availableConfigs`.

### Current Behavior

- Each document processed independently
- Results saved as array or single object
- No extraction of unique c1 values for `availableConfigs`

### Expected Behavior (from `registry_schema.json`)

```json
{
  "version": "1.0.0",
  "description": "Registry description",
  "tools": {
    "availableConfigs": ["git", "spec", "test"],  // Unique c1 values
    "commands": [...]  // All processed commands
  }
}
```

### Impact

- Cannot generate valid registry structure
- `availableConfigs` field missing or empty
- Registry structure doesn't match schema

### Solution

1. Create `RegistryAggregator` domain service
2. Extract unique c1 values from all commands
3. Build proper registry structure

---

## Issue #6: Domain Boundaries Don't Reflect Two-Stage Architecture

### Problem

Domain boundary documents (`docs/domain/domain-boundary.md`,
`docs/architecture/domain-boundaries.md`) don't account for two-stage processing
requirements.

### Current State

- Single-stage processing assumed
- No distinction between command and registry domains
- Missing aggregation domain

### Required Domains

1. **Command Processing Domain**: Individual markdown → command
2. **Registry Aggregation Domain**: Commands → registry
3. **Template Transformation Domain**: Two-stage template application

### Impact

- Architecture doesn't match requirements
- Missing domain services and entities
- Unclear separation of concerns

### Solution

1. Update domain boundary documents
2. Add new domains for two-stage processing
3. Define clear interfaces between stages

---

## Priority Order

1. **Critical**: Issue #3 (c1/c2/c3 extraction) - Core functionality broken
2. **Critical**: Issue #4 (Template substitution) - Output unusable
3. **High**: Issue #2 (Two-stage pipeline) - Architecture mismatch
4. **High**: Issue #5 (Registry aggregation) - Required for proper output
5. **Medium**: Issue #1 (CLI arguments) - User experience issue
6. **Medium**: Issue #6 (Domain boundaries) - Documentation/design issue

## Verification Steps

To verify these issues, run:

```bash
./frontmatter-to-schema .agent/test-climpt/prompts \
  --schema=.agent/test-climpt/registry_command_schema.json \
  --template=.agent/test-climpt/registry_command_template.json \
  --output=test-output.json \
  --verbose
```

Expected: Properly formatted registry with c1/c2/c3 fields Actual: Missing
fields, unsubstituted placeholders
