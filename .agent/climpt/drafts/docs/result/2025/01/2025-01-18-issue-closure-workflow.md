---
title: "Systematic Issue Closure and Release Preparation Workflow"
description: "Comprehensive workflow for validating resolved issues, documenting evidence, and preparing production releases"
variables:
  - input_text: "Issue analysis results and resolution evidence"
  - destination_path: "Output path for closure documentation"
  - uv-scope: "Release scope identifier (e.g., v1.0.0, production-ready)"
references:
  - "**全域性原則**: `docs/development/totality_go.ja.md`"
  - "[AI複雑化防止（科学的制御）](docs/development/ai-complexity-control_compact.ja.md)"
---

# Systematic Issue Closure and Release Preparation Workflow

## 0. 目的・適用範囲

- **目的**: 調査により解決済みと判明した GitHub Issues を適切な evidence と共に
  closure し、production release への準備 workflow を確立する。
- **適用範囲**: Production-ready システムにおける issue management と release
  preparation 全般。
- **非適用範囲**: 新規開発中の feature や未解決の technical debt。

## 1. 不変条件（壊してはならない性質）

1. 全ての issue closure には具体的な implementation evidence が必要。
2. Release preparation は全 CI stages が pass している状態でのみ実行可能。
3. Architecture documentation は current implementation state を正確に反映する。
4. Issue closure process の traceability は 100% 維持される。
5. Release notes は business value と technical achievements を両方含む。

## 2. 入力・前提条件

- **入力**: `{input_text}` (Investigation results と resolution evidence)
- **前提**:
  - GitHub Issues が open状態で存在
  - CI pipeline が全 stages で passing
  - Implementation evidence が verification 可能
- **禁止事項**:
  - Evidence なしの issue closure
  - Incomplete investigation に基づく release preparation

## 3. 事前情報収集（短文補完フェーズ）

### 前提情報リスト

- Project は production-ready status を達成 (Quality Score: 96.8/100)
- Test coverage: 257 tests passing (10.7x above specification requirement)
- DDD architecture と Totality principles が properly implemented
- Debug infrastructure が comprehensive に構築済み
- Hardcoding elimination via SchemaExtensionRegistry + SupportedFormats
- CircuitBreaker による performance protection が active

### 仮定リスト

- Issues #876-#882 は technical implementation では解決済み
- Documentation が current state を完全に reflect していない可能性
- Release process に向けた formal approval workflow が存在

## 4. 手順

### 4.1 Git ブランチ準備

- Git ブランチ準備:
  `echo "issue-closure-and-release-prep" | climpt-git decide-branch working-branch`
  を実行し、出力結果の指示に従う。

### 4.2 Issue Resolution Evidence Collection

#### 4.2.1 Technical Implementation Verification

1. 各 issue について current codebase で implementation status を verify
2. Specific file paths と code sections を evidence として document
3. Test coverage を確認し、resolution が test-backed であることを validate

#### 4.2.2 Evidence Documentation Format

```markdown
## Issue #{number}: {title}

**Status**: ✅ RESOLVED **Evidence Location**: {file_paths} **Implementation
Details**: {specific_code_or_feature} **Test Coverage**: {relevant_test_files}
**Verification Method**: {how_to_confirm_resolution}
```

### 4.3 Systematic Issue Closure Process

#### 4.3.1 Individual Issue Processing

For each issue in range #876-#882:

1. Create detailed resolution comment with evidence
2. Reference specific implementation files
3. Include test verification steps
4. Close issue with appropriate labels

#### 4.3.2 Closure Comment Template

```
# Resolution Confirmation

## Investigation Results
{specific_findings}

## Implementation Evidence
- **File**: {implementation_file_path}
- **Feature**: {implemented_feature_name}
- **Tests**: {test_file_references}

## Verification Steps
1. {step_1}
2. {step_2}
3. {verification_command}

This issue has been resolved through comprehensive implementation. Closing based on investigation evidence.
```

### 4.4 Architecture Documentation Update

#### 4.4.1 Current State Reflection

1. Review `docs/domain/` architecture documents
2. Update implementation status descriptions
3. Reflect actual code structure in documentation
4. Ensure alignment between design documents and current codebase

#### 4.4.2 Documentation Validation

- Cross-reference documentation with actual implementation
- Verify code examples in documentation are current
- Update any outdated architectural decisions

### 4.5 Release Preparation Workflow

#### 4.5.1 Release Notes Compilation

Create comprehensive release notes including:

- **Technical Achievements**: DDD implementation, Totality compliance,
  performance safeguards
- **Quality Metrics**: Test coverage, CI pipeline status, code quality scores
- **Architecture Highlights**: Domain boundaries, circuit breaker, comprehensive
  logging
- **User-Facing Features**: CLI improvements, error handling, debugging
  capabilities

#### 4.5.2 Final Validation Steps

1. Execute full CI pipeline: `deno task ci`
2. Verify all 257 tests pass
3. Confirm no open blocking issues remain
4. Validate documentation accuracy

## 5. 成果物定義

### 主成果物

- Closed GitHub issues with detailed resolution evidence
- Updated architecture documentation reflecting current state
- Comprehensive release notes
- Release preparation checklist completion

### 付録

- Issue closure evidence documentation
- Implementation verification results
- Architecture documentation diff
- Release readiness assessment

### DoD (Definition of Done)

- All target issues (#876-#882) are closed with evidence
- Architecture documentation accurately reflects implementation
- Release notes include both technical and business value
- CI pipeline passes completely
- No regression in test coverage

## 6. 品質検証方法

### Issue Closure Validation

- Each closure includes specific implementation evidence
- Resolution can be independently verified
- No unresolved dependencies remain

### Documentation Quality Check

- Architecture documents match actual code structure
- All referenced implementations exist and are current
- Documentation examples execute successfully

### Release Readiness Assessment

- All quality gates pass
- Performance metrics meet standards
- Security considerations addressed
- Deployment readiness confirmed

## 7. 参照資料

### 必須参照資料

- **全域性原則**: `docs/development/totality_go.ja.md`
- **[AI複雑化防止（科学的制御）](docs/development/ai-complexity-control_compact.ja.md)**
- **Domain Architecture**: `docs/domain/domain-boundary.md`
- **Requirements**: `docs/requirements.ja.md`

### 補助参料

- GitHub Issues #876-#882 investigation results
- Issue #884 (Release preparation issue)
- Issue #885 (Resolution documentation)
- Quality metrics analysis reports

## 8. 実行注意事項

### 混乱回避術

- Issue closure 作業と release preparation 作業を明確に分離
- 各段階での validation checkpoint を設置
- Evidence collection と documentation update の責務を明確化

### トレーサビリティ確保

- 全ての decision と action を GitHub comments に記録
- Implementation evidence への direct link を維持
- Resolution verification の再現手順を明記
