# Totality Principle Verification Workflow

## Overview

Totality原則（すべての関数が完全であり、例外を投げずにResult<T,E>パターンを使用する）の遵守状況を検証するワークフロー。

## Purpose

アーキテクチャ違反（直接throw、console使用等）を検出し、コードベースの堅牢性を確保する。

## Dependencies

- **01-quality-assurance/01-false-resolution-detection.workflow.md**:
  品質基盤確立

## Execution Steps

### Phase 1: Architecture Violation Detection (10分)

#### 1.1 Direct Throw Detection

```bash
# Find all files with direct throw statements
echo "=== Direct Throw Violations ==="
find . -name "*.ts" -type f | xargs grep -l "throw new Error" > tmp/throw-violations.txt
THROW_COUNT=$(cat tmp/throw-violations.txt | wc -l)
echo "Files with direct throws: $THROW_COUNT"

# Detailed analysis
echo "=== Detailed Throw Analysis ==="
find . -name "*.ts" -type f | xargs grep -n "throw new Error" > tmp/throw-details.txt
cat tmp/throw-details.txt | head -20
```

#### 1.2 Console Usage Detection

```bash
# Find all files with direct console usage
echo "=== Console Usage Violations ==="
find . -name "*.ts" -type f | xargs grep -l "console\." > tmp/console-violations.txt
CONSOLE_COUNT=$(cat tmp/console-violations.txt | wc -l)
echo "Files with console usage: $CONSOLE_COUNT"

# Detailed analysis
find . -name "*.ts" -type f | xargs grep -n "console\." > tmp/console-details.txt
cat tmp/console-details.txt | head -20
```

#### 1.3 Result Pattern Compliance

```bash
# Check for proper Result<T,E> usage
echo "=== Result Pattern Compliance ==="
RESULT_USAGE=$(find . -name "*.ts" -type f | xargs grep -l "Result<" | wc -l)
TOTAL_TS_FILES=$(find . -name "*.ts" -type f | wc -l)
COMPLIANCE_RATE=$((RESULT_USAGE * 100 / TOTAL_TS_FILES))
echo "Result pattern usage: $RESULT_USAGE/$TOTAL_TS_FILES files ($COMPLIANCE_RATE%)"
```

### Phase 2: Totality Assessment (15分)

#### 2.1 Function Completeness Analysis

```bash
# Analyze function signature patterns
echo "=== Function Completeness Analysis ==="

# Functions that might not be total (return undefined, throw)
grep -r "return undefined" --include="*.ts" . | wc -l > tmp/incomplete-functions.txt
echo "Functions returning undefined: $(cat tmp/incomplete-functions.txt)"

# Functions using try-catch without Result patterns
grep -r -A 5 "try {" --include="*.ts" . | grep -v "Result<" | wc -l > tmp/try-catch-violations.txt
echo "Try-catch without Result pattern: $(cat tmp/try-catch-violations.txt)"
```

#### 2.2 Error Boundary Analysis

```bash
# Check error handling boundaries
echo "=== Error Boundary Analysis ==="

# Domain services with proper error handling
find src/domain -name "*.ts" | xargs grep -l "Result<.*Error>" | wc -l > tmp/domain-compliance.txt
DOMAIN_FILES=$(find src/domain -name "*.ts" | wc -l)
DOMAIN_COMPLIANCE=$(cat tmp/domain-compliance.txt)
echo "Domain services with Result pattern: $DOMAIN_COMPLIANCE/$DOMAIN_FILES"

# Application services compliance
find src/application -name "*.ts" | xargs grep -l "Result<.*Error>" | wc -l > tmp/app-compliance.txt
APP_FILES=$(find src/application -name "*.ts" | wc -l)
APP_COMPLIANCE=$(cat tmp/app-compliance.txt)
echo "Application services with Result pattern: $APP_COMPLIANCE/$APP_FILES"
```

### Phase 3: Compliance Report Generation (5分)

#### 3.1 Generate Compliance Report

```bash
# Generate comprehensive compliance report
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="tmp/totality-compliance-${TIMESTAMP}.md"

cat > "$REPORT_FILE" << EOF
# Totality Principle Compliance Report

Generated: $(date)

## Executive Summary

- **Architecture Violations**: $((THROW_COUNT + CONSOLE_COUNT)) files
- **Direct Throws**: $THROW_COUNT files
- **Console Usage**: $CONSOLE_COUNT files
- **Result Pattern Adoption**: $COMPLIANCE_RATE%
- **Domain Compliance**: $DOMAIN_COMPLIANCE/$DOMAIN_FILES files
- **Application Compliance**: $APP_COMPLIANCE/$APP_FILES files

## Risk Assessment

EOF

# Calculate risk score
RISK_SCORE=0
if [ $THROW_COUNT -gt 50 ]; then
    RISK_SCORE=$((RISK_SCORE + 4))
    echo "⚠️  HIGH: $THROW_COUNT direct throw violations (+4)" >> "$REPORT_FILE"
fi

if [ $CONSOLE_COUNT -gt 20 ]; then
    RISK_SCORE=$((RISK_SCORE + 2))
    echo "⚠️  MEDIUM: $CONSOLE_COUNT console usage violations (+2)" >> "$REPORT_FILE"
fi

if [ $COMPLIANCE_RATE -lt 30 ]; then
    RISK_SCORE=$((RISK_SCORE + 3))
    echo "⚠️  HIGH: Low Result pattern adoption $COMPLIANCE_RATE% (+3)" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

**Total Risk Score**: $RISK_SCORE/10

## Recommendations

EOF

if [ $RISK_SCORE -ge 7 ]; then
    echo "🚨 CRITICAL: Immediate totality principle implementation required" >> "$REPORT_FILE"
elif [ $RISK_SCORE -ge 4 ]; then
    echo "⚠️  HIGH: Systematic refactoring needed" >> "$REPORT_FILE"
else
    echo "✅ ACCEPTABLE: Incremental improvements recommended" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

## Detailed Violations

### Direct Throw Violations
$(head -20 tmp/throw-details.txt)

### Console Usage Violations
$(head -20 tmp/console-details.txt)

## Action Items

1. Replace direct throws with Result<T,E> pattern
2. Replace console.* with proper logging services
3. Implement error boundaries in domain services
4. Add Result pattern to application services
5. Create totality compliance tests

EOF

echo "📄 Report generated: $REPORT_FILE"
```

## Success Criteria

- **PASS**: Risk score ≤ 3, >70% Result pattern adoption
- **WARNING**: Risk score 4-6, 30-70% Result pattern adoption
- **FAIL**: Risk score ≥ 7, <30% Result pattern adoption

## Output Artifacts

- `tmp/totality-compliance-{timestamp}.md`: Detailed compliance report
- `tmp/throw-violations.txt`: Files with direct throw statements
- `tmp/console-violations.txt`: Files with console usage
- `tmp/throw-details.txt`: Detailed throw locations
- `tmp/console-details.txt`: Detailed console usage locations

## Integration

### CI/CD Integration

```yaml
# Add to GitHub Actions
- name: Totality Principle Verification
  run: |
    cd docs/tests/debugs/02-architecture
    bash 01-totality-verification.workflow.md
    # Check if risk score is acceptable
    RISK_SCORE=$(grep "Total Risk Score" tmp/totality-compliance-*.md | tail -1 | cut -d: -f2 | cut -d/ -f1 | tr -d ' ')
    if [ $RISK_SCORE -ge 7 ]; then
      echo "::error::Totality principle violations too high: $RISK_SCORE/10"
      exit 1
    fi
```

### Development Workflow

```bash
# Pre-commit check
docs/tests/debugs/02-architecture/01-totality-verification.workflow.md

# Weekly review
# Execute and review compliance report
# Plan refactoring for high-risk areas
```

## Maintenance

### Threshold Updates

- Adjust violation counts based on codebase size
- Update compliance percentage targets
- Modify risk scoring algorithm

### Pattern Evolution

- Add new violation patterns as discovered
- Update Result<T,E> pattern variations
- Include new logging service patterns

---

**Note**: This workflow focuses on architectural compliance rather than
functional correctness. It ensures code follows the totality principle for
maximum reliability and predictability.
