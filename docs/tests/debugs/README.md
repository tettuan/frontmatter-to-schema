# Debugging Workflows Documentation

## Quick Start

### Daily Quality Check (30 seconds)

```bash
# Navigate to debugging workflows
cd docs/tests/debugs

# Quick false resolution detection
./01-quality-assurance/01-false-resolution-detection.workflow.md
```

### Weekly Analysis (15 minutes)

```bash
# Full quality and architecture assessment
cd docs/tests/debugs

# Execute in dependency order
./01-quality-assurance/01-false-resolution-detection.workflow.md
./02-architecture/01-totality-verification.workflow.md
./03-features/01-directive-implementation.workflow.md
```

## Structure Overview

```
docs/tests/debugs/
├── debugging-workflows.md                   # Master index and execution guide
├── README.md                               # This quick start guide
├── 01-quality-assurance/                  # Process integrity workflows
├── 02-architecture/                       # Architecture compliance workflows
├── 03-features/                          # Feature implementation workflows
└── templates/                            # Reusable workflow templates
```

## Workflow Categories

### 01. Quality Assurance

**Focus**: Development process integrity **Frequency**: Daily/Commit-time
**Purpose**: Detect false resolution claims, process inconsistencies

### 02. Architecture

**Focus**: DDD, Totality, AI-complexity-control compliance **Frequency**:
Weekly/Release-time **Purpose**: Ensure architectural principles adherence

### 03. Features

**Focus**: Implementation completeness and quality **Frequency**:
Sprint/Feature-time **Purpose**: Verify feature implementation and test coverage

## Quick Reference

### Most Common Workflows

#### False Resolution Detection

```bash
# Check if recent "fix" commits actually fix issues
scripts/detect-false-claims.sh
```

#### Architecture Compliance Check

```bash
# Verify Totality principle compliance
cd docs/tests/debugs/02-architecture
./01-totality-verification.workflow.md
```

#### Feature Implementation Status

```bash
# Check directive implementation completeness
cd docs/tests/debugs/03-features
./01-directive-implementation.workflow.md
```

### Emergency Diagnostics

#### System Health Check

```bash
# Quick system health verification
deno check **/*.ts && echo "✅ Types OK" || echo "❌ Type errors"
deno test --allow-all --no-check > /dev/null && echo "✅ Tests OK" || echo "❌ Test failures"
find . -name "*.ts" | xargs grep -l "throw new Error" | wc -l  # Architecture violations
```

#### Issue Verification

```bash
# Verify issue resolution claims
git log --oneline -3 | grep -E "(fix|complete|resolve)"
gh issue list --state open --label "high-priority" --json number | jq length
```

## Integration

### Pre-commit Hook

```bash
# Add to .git/hooks/pre-commit
#!/bin/bash
cd docs/tests/debugs
./01-quality-assurance/01-false-resolution-detection.workflow.md
```

### GitHub Actions

```yaml
name: Debugging Workflows
on: [push, pull_request]
jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Quality Assurance
        run: |
          cd docs/tests/debugs/01-quality-assurance
          ./01-false-resolution-detection.workflow.md
```

### Development Workflow

1. **Before commit**: Run quality assurance workflows
2. **Before merge**: Run architecture compliance workflows
3. **Before release**: Run feature implementation workflows

## Output Locations

All workflow outputs are stored in `tmp/` directory:

- Reports: `tmp/*-report-{timestamp}.md`
- Data files: `tmp/*-{workflow}-{timestamp}.{ext}`
- Logs: `tmp/debug-{workflow}-{timestamp}.log`

## Troubleshooting

### Common Issues

#### Workflow Execution Fails

```bash
# Check dependencies
which deno gh jq
# Ensure tmp directory exists
mkdir -p tmp
# Check file permissions
chmod +x scripts/*.sh
```

#### Reports Not Generated

```bash
# Verify output directory
ls -la tmp/
# Check disk space
df -h .
```

#### False Positives in Detection

```bash
# Adjust thresholds in workflow files
# Review detection logic
# Update patterns for new code styles
```

## Contributing

### Adding New Workflows

1. Use `templates/workflow-template.md` as base
2. Follow naming convention: `{order}-{purpose}.workflow.md`
3. Update master index in `debugging-workflows.md`
4. Test workflow execution

### Modifying Existing Workflows

1. Maintain backward compatibility
2. Update documentation
3. Test with real project data
4. Update success criteria if needed

---

For detailed information, see [debugging-workflows.md](./debugging-workflows.md)
