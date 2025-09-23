# Directive Implementation Verification Workflow

## Overview

ディレクティブ実装の完全性とテストカバレッジを検証するワークフロー。実装済み・未実装の判定と品質評価。

## Purpose

スキーマディレクティブ（x-frontmatter-part、x-derived-from、x-flatten-arrays等）の実装状況を体系的に検証し、機能gaps
を特定する。

## Dependencies

- **01-quality-assurance/01-false-resolution-detection.workflow.md**: 品質基盤
- **02-architecture/01-totality-verification.workflow.md**: アーキテクチャ基盤

## Execution Steps

### Phase 1: Directive Discovery (5分)

#### 1.1 Documentation Analysis

```bash
echo "=== Documented Directives Analysis ==="

# Find all documented directives
grep -r "x-[a-z-]*" docs/ --include="*.md" | grep -o "x-[a-z-]*" | sort | uniq > tmp/documented-directives.txt
DOCUMENTED_COUNT=$(cat tmp/documented-directives.txt | wc -l)
echo "Documented directives: $DOCUMENTED_COUNT"
echo "List:"
cat tmp/documented-directives.txt | nl
```

#### 1.2 Codebase Implementation Discovery

```bash
echo "=== Implementation Discovery ==="

# Find directive validation in code
find src/ -name "*.ts" | xargs grep -l "x-[a-z-]*" > tmp/implementation-files.txt
echo "Files with directive implementation: $(cat tmp/implementation-files.txt | wc -l)"

# Find specific directive processors
grep -r "validateTemplateDirective\|validateFlattenArraysDirective\|validateDerivedFromDirective" src/ --include="*.ts" > tmp/validator-implementations.txt
echo "Validator implementations found: $(cat tmp/validator-implementations.txt | wc -l)"

# Find directive processors
grep -r "processFlattenArraysDirective\|processDerivedFromDirective" src/ --include="*.ts" > tmp/processor-implementations.txt
echo "Processor implementations found: $(cat tmp/processor-implementations.txt | wc -l)"
```

#### 1.3 Test Coverage Discovery

```bash
echo "=== Test Coverage Discovery ==="

# Find directive tests
find tests/ -name "*.ts" | xargs grep -l "x-[a-z-]*" > tmp/test-files.txt
echo "Test files covering directives: $(cat tmp/test-files.txt | wc -l)"

# Specific directive test patterns
grep -r "x-flatten-arrays\|x-derived-from\|x-frontmatter-part" tests/ --include="*.ts" | wc -l > tmp/directive-test-coverage.txt
echo "Directive test cases: $(cat tmp/directive-test-coverage.txt)"
```

### Phase 2: Implementation Status Matrix (10分)

#### 2.1 Generate Implementation Matrix

```bash
echo "=== Implementation Status Matrix ==="

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MATRIX_FILE="tmp/directive-implementation-matrix-${TIMESTAMP}.md"

cat > "$MATRIX_FILE" << 'EOF'
# Directive Implementation Status Matrix

Generated: $(date)

| Directive | Documented | Validated | Processed | Tested | Status |
|-----------|------------|-----------|-----------|---------|--------|
EOF

# Check each known directive
DIRECTIVES=("x-frontmatter-part" "x-derived-from" "x-flatten-arrays" "x-template" "x-template-items" "x-jmespath-filter" "x-derived-unique")

for directive in "${DIRECTIVES[@]}"; do
    # Check documentation
    DOC_STATUS="❌"
    if grep -q "$directive" docs/requirements.ja.md 2>/dev/null; then
        DOC_STATUS="✅"
    fi

    # Check validation
    VAL_STATUS="❌"
    if grep -q "validate.*${directive//-/}" src/domain/schema/validators/ -r 2>/dev/null; then
        VAL_STATUS="✅"
    fi

    # Check processing
    PROC_STATUS="❌"
    if grep -q "process.*${directive//-/}" src/domain/schema/services/ -r 2>/dev/null; then
        PROC_STATUS="✅"
    fi

    # Check testing
    TEST_STATUS="❌"
    if grep -q "$directive" tests/ -r 2>/dev/null; then
        TEST_STATUS="✅"
    fi

    # Determine overall status
    OVERALL="🔄 Partial"
    if [[ "$DOC_STATUS" == "✅" && "$VAL_STATUS" == "✅" && "$PROC_STATUS" == "✅" && "$TEST_STATUS" == "✅" ]]; then
        OVERALL="✅ Complete"
    elif [[ "$DOC_STATUS" == "❌" && "$VAL_STATUS" == "❌" && "$PROC_STATUS" == "❌" ]]; then
        OVERALL="❌ Missing"
    fi

    echo "| $directive | $DOC_STATUS | $VAL_STATUS | $PROC_STATUS | $TEST_STATUS | $OVERALL |" >> "$MATRIX_FILE"
done

echo "📊 Implementation matrix: $MATRIX_FILE"
```

#### 2.2 Gap Analysis

```bash
echo "=== Gap Analysis ==="

# Count implementation gaps
COMPLETE_COUNT=$(grep "✅ Complete" "$MATRIX_FILE" | wc -l)
PARTIAL_COUNT=$(grep "🔄 Partial" "$MATRIX_FILE" | wc -l)
MISSING_COUNT=$(grep "❌ Missing" "$MATRIX_FILE" | wc -l)
TOTAL_DIRECTIVES=${#DIRECTIVES[@]}

echo "Implementation Status:"
echo "  Complete: $COMPLETE_COUNT/$TOTAL_DIRECTIVES ($(($COMPLETE_COUNT * 100 / $TOTAL_DIRECTIVES))%)"
echo "  Partial: $PARTIAL_COUNT/$TOTAL_DIRECTIVES ($(($PARTIAL_COUNT * 100 / $TOTAL_DIRECTIVES))%)"
echo "  Missing: $MISSING_COUNT/$TOTAL_DIRECTIVES ($(($MISSING_COUNT * 100 / $TOTAL_DIRECTIVES))%)"

# Identify critical gaps
cat >> "$MATRIX_FILE" << EOF

## Gap Analysis

### Implementation Completeness
- **Complete**: $COMPLETE_COUNT/$TOTAL_DIRECTIVES ($(($COMPLETE_COUNT * 100 / $TOTAL_DIRECTIVES))%)
- **Partial**: $PARTIAL_COUNT/$TOTAL_DIRECTIVES ($(($PARTIAL_COUNT * 100 / $TOTAL_DIRECTIVES))%)
- **Missing**: $MISSING_COUNT/$TOTAL_DIRECTIVES ($(($MISSING_COUNT * 100 / $TOTAL_DIRECTIVES))%)

### Critical Gaps
EOF

# List critical gaps
grep "❌ Missing\|🔄 Partial" "$MATRIX_FILE" | while read line; do
    DIRECTIVE=$(echo "$line" | cut -d'|' -f2 | tr -d ' ')
    STATUS=$(echo "$line" | cut -d'|' -f6 | tr -d ' ')
    echo "- **$DIRECTIVE**: $STATUS" >> "$MATRIX_FILE"
done
```

### Phase 3: Quality Assessment (10分)

#### 3.1 Test Quality Analysis

```bash
echo "=== Test Quality Analysis ==="

# Analyze test patterns for each directive
for directive in "${DIRECTIVES[@]}"; do
    echo "Analyzing tests for: $directive"

    # Count test cases
    TEST_CASES=$(grep -r "$directive" tests/ --include="*.ts" | wc -l)

    # Check for validation tests
    VALIDATION_TESTS=$(grep -r "validate.*$directive\|$directive.*valid" tests/ --include="*.ts" | wc -l)

    # Check for processing tests
    PROCESSING_TESTS=$(grep -r "process.*$directive\|$directive.*process" tests/ --include="*.ts" | wc -l)

    # Check for error handling tests
    ERROR_TESTS=$(grep -r -A 2 -B 2 "$directive" tests/ --include="*.ts" | grep -i "error\|fail\|invalid" | wc -l)

    echo "  Test cases: $TEST_CASES"
    echo "  Validation tests: $VALIDATION_TESTS"
    echo "  Processing tests: $PROCESSING_TESTS"
    echo "  Error handling tests: $ERROR_TESTS"
done
```

#### 3.2 Implementation Quality Metrics

```bash
echo "=== Implementation Quality Metrics ==="

# Check for proper error handling in implementations
IMPLEMENTATIONS_WITH_ERRORS=$(find src/ -name "*.ts" | xargs grep -l "x-[a-z-]*" | xargs grep -l "Result<.*Error>" | wc -l)
TOTAL_IMPLEMENTATIONS=$(find src/ -name "*.ts" | xargs grep -l "x-[a-z-]*" | wc -l)

if [ $TOTAL_IMPLEMENTATIONS -gt 0 ]; then
    ERROR_HANDLING_RATE=$(($IMPLEMENTATIONS_WITH_ERRORS * 100 / $TOTAL_IMPLEMENTATIONS))
else
    ERROR_HANDLING_RATE=0
fi

echo "Error handling compliance: $IMPLEMENTATIONS_WITH_ERRORS/$TOTAL_IMPLEMENTATIONS ($ERROR_HANDLING_RATE%)"

# Check for proper documentation in code
DOCUMENTED_IMPLEMENTATIONS=$(find src/ -name "*.ts" | xargs grep -l "x-[a-z-]*" | xargs grep -l "/\*\*" | wc -l)
DOC_RATE=$(($DOCUMENTED_IMPLEMENTATIONS * 100 / $TOTAL_IMPLEMENTATIONS))
echo "Documentation rate: $DOCUMENTED_IMPLEMENTATIONS/$TOTAL_IMPLEMENTATIONS ($DOC_RATE%)"
```

### Phase 4: Report Generation (5分)

#### 4.1 Comprehensive Report

```bash
# Generate final report
REPORT_FILE="tmp/directive-implementation-report-${TIMESTAMP}.md"

cat > "$REPORT_FILE" << EOF
# Directive Implementation Verification Report

Generated: $(date)

## Executive Summary

- **Total Directives Analyzed**: $TOTAL_DIRECTIVES
- **Implementation Completeness**: $(($COMPLETE_COUNT * 100 / $TOTAL_DIRECTIVES))%
- **Error Handling Compliance**: $ERROR_HANDLING_RATE%
- **Documentation Rate**: $DOC_RATE%

## Risk Assessment

EOF

# Calculate risk score
RISK_SCORE=0

if [ $COMPLETE_COUNT -lt $(($TOTAL_DIRECTIVES / 2)) ]; then
    RISK_SCORE=$((RISK_SCORE + 4))
    echo "⚠️  HIGH: Low implementation completeness (<50%) (+4)" >> "$REPORT_FILE"
fi

if [ $ERROR_HANDLING_RATE -lt 70 ]; then
    RISK_SCORE=$((RISK_SCORE + 3))
    echo "⚠️  HIGH: Poor error handling compliance (<70%) (+3)" >> "$REPORT_FILE"
fi

if [ $MISSING_COUNT -gt 2 ]; then
    RISK_SCORE=$((RISK_SCORE + 2))
    echo "⚠️  MEDIUM: Multiple missing implementations (+2)" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

**Total Risk Score**: $RISK_SCORE/10

## Implementation Matrix

$(cat "$MATRIX_FILE")

## Recommendations

EOF

if [ $RISK_SCORE -ge 7 ]; then
    echo "🚨 CRITICAL: Immediate directive implementation required" >> "$REPORT_FILE"
    echo "1. Prioritize missing critical directives" >> "$REPORT_FILE"
    echo "2. Implement proper error handling" >> "$REPORT_FILE"
    echo "3. Add comprehensive test coverage" >> "$REPORT_FILE"
elif [ $RISK_SCORE -ge 4 ]; then
    echo "⚠️  HIGH: Systematic implementation improvements needed" >> "$REPORT_FILE"
    echo "1. Complete partial implementations" >> "$REPORT_FILE"
    echo "2. Enhance error handling" >> "$REPORT_FILE"
    echo "3. Improve test coverage" >> "$REPORT_FILE"
else
    echo "✅ ACCEPTABLE: Incremental improvements recommended" >> "$REPORT_FILE"
    echo "1. Polish existing implementations" >> "$REPORT_FILE"
    echo "2. Add edge case tests" >> "$REPORT_FILE"
    echo "3. Enhance documentation" >> "$REPORT_FILE"
fi

echo "📄 Final report: $REPORT_FILE"
```

## Success Criteria

- **PASS**: >80% implementation completeness, >70% error handling compliance
- **WARNING**: 50-80% completeness, 50-70% error handling compliance
- **FAIL**: <50% completeness, <50% error handling compliance

## Output Artifacts

- `tmp/directive-implementation-report-{timestamp}.md`: Comprehensive analysis
- `tmp/directive-implementation-matrix-{timestamp}.md`: Implementation status
  matrix
- `tmp/documented-directives.txt`: All documented directives
- `tmp/implementation-files.txt`: Files with implementations
- `tmp/test-files.txt`: Test files covering directives

## Integration

### GitHub Issues Integration

```bash
# Create issues for missing implementations
grep "❌ Missing" tmp/directive-implementation-matrix-*.md | while read line; do
    DIRECTIVE=$(echo "$line" | cut -d'|' -f2 | tr -d ' ')
    echo "Consider creating issue for: $DIRECTIVE implementation"
done
```

### CI/CD Integration

```yaml
- name: Directive Implementation Verification
  run: |
    cd docs/tests/debugs/03-features
    bash 01-directive-implementation.workflow.md
    # Check implementation completeness
    COMPLETENESS=$(grep "Implementation Completeness" tmp/directive-implementation-report-*.md | grep -o "[0-9]*%" | sed 's/%//')
    if [ $COMPLETENESS -lt 50 ]; then
      echo "::error::Directive implementation completeness too low: $COMPLETENESS%"
      exit 1
    fi
```

---

**Note**: This workflow identifies implementation gaps and quality issues but
does not modify code. It provides actionable intelligence for development
planning and priority setting.
