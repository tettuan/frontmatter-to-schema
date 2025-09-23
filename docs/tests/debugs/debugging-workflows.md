# Debugging Workflows - Master Index

## Overview

プロジェクトの品質保証とデバッグのための体系的ワークフロー集。各ワークフローは特定の問題領域に対応し、明確な実行順序と依存関係を持つ。

## Workflow Hierarchy

### 01. Quality Assurance Workflows

継続的品質管理のための基礎ワークフロー。開発プロセスの整合性確保。

#### 01-01. False Resolution Detection

**File**: `01-quality-assurance/01-false-resolution-detection.workflow.md`
**Purpose**: 虚偽解決問題の検出・防止 **Frequency**: 日次・コミット時
**Dependencies**: None (基礎ワークフロー)

```bash
# Quick execution
./scripts/detect-false-claims.sh

# Detailed analysis
./scripts/analyze-resolution-integrity.sh
```

### 02. Architecture Compliance Workflows

アーキテクチャ原則（DDD、Totality、AI-complexity-control）の遵守確認。

#### 02-01. Totality Principle Verification

**File**: `02-architecture/01-totality-verification.workflow.md` **Purpose**:
Totality原則違反の検出（直接throw、console使用等） **Frequency**:
週次・リリース前 **Dependencies**: 01-01 (品質基盤)

#### 02-02. DDD Boundary Validation

**File**: `02-architecture/02-ddd-boundary-validation.workflow.md` **Purpose**:
ドメイン境界違反とサービス責務の検証 **Frequency**: 月次・大規模変更時
**Dependencies**: 02-01 (アーキテクチャ基盤)

### 03. Feature Implementation Workflows

特定機能の実装品質とテストカバレッジの検証。

#### 03-01. Directive Implementation Verification

**File**: `03-features/01-directive-implementation.workflow.md` **Purpose**:
ディレクティブ実装の完全性確認 **Frequency**: 機能追加・変更時 **Dependencies**:
01-01, 02-01 (品質・アーキテクチャ基盤)

#### 03-02. Test Coverage Analysis

**File**: `03-features/02-test-coverage-analysis.workflow.md` **Purpose**:
テストカバレッジと仕様反映度の分析 **Frequency**: スプリント終了時
**Dependencies**: 03-01 (機能検証基盤)

### Templates

再利用可能なワークフローテンプレートとガイドライン。

#### Workflow Template

**File**: `templates/workflow-template.md` **Purpose**:
新規ワークフロー作成の標準テンプレート **Usage**:
新しいデバッグワークフロー作成時に使用

## Execution Patterns

### Daily Quality Check

```bash
# 日次品質確認（5分以内）
cd docs/tests/debugs/01-quality-assurance
./01-false-resolution-detection.workflow.md  # Quick check scripts
```

### Weekly Deep Analysis

```bash
# 週次詳細分析（30分）
cd docs/tests/debugs
# 1. Quality assurance
01-quality-assurance/01-false-resolution-detection.workflow.md
# 2. Architecture compliance
02-architecture/01-totality-verification.workflow.md
# 3. Feature verification
03-features/01-directive-implementation.workflow.md
```

### Release Validation

```bash
# リリース前検証（1時間）
cd docs/tests/debugs
# Full workflow execution in dependency order
for workflow in \
  01-quality-assurance/01-false-resolution-detection.workflow.md \
  02-architecture/01-totality-verification.workflow.md \
  02-architecture/02-ddd-boundary-validation.workflow.md \
  03-features/01-directive-implementation.workflow.md \
  03-features/02-test-coverage-analysis.workflow.md; do
  echo "Executing: $workflow"
  # Execute workflow
done
```

## Directory Structure

```
docs/tests/debugs/
├── debugging-workflows.md              # This master index
├── 01-quality-assurance/               # Quality management workflows
│   └── 01-false-resolution-detection.workflow.md
├── 02-architecture/                    # Architecture compliance workflows
│   ├── 01-totality-verification.workflow.md
│   └── 02-ddd-boundary-validation.workflow.md
├── 03-features/                       # Feature implementation workflows
│   ├── 01-directive-implementation.workflow.md
│   └── 02-test-coverage-analysis.workflow.md
└── templates/                         # Reusable templates
    └── workflow-template.md
```

## Workflow Development Guidelines

### Naming Convention

- **Directories**: `{order}-{category}/`
- **Files**: `{order}-{specific-purpose}.workflow.md`
- **Scripts**: Corresponding scripts in `scripts/` directory

### Dependency Management

- Each workflow declares its dependencies
- Execution order follows dependency hierarchy
- Independent workflows can run in parallel

### Quality Standards

- Each workflow must have clear success criteria
- All workflows must generate actionable outputs
- Execution time should be documented and optimized

### Integration Requirements

- Compatible with CI/CD pipeline
- Support both manual and automated execution
- Generate structured reports for analysis

## Maintenance

### Adding New Workflows

1. Use `templates/workflow-template.md` as starting point
2. Follow naming convention and numbering
3. Update this master index with new workflow
4. Establish dependencies and execution order

### Workflow Lifecycle

- **Active**: Regular execution and maintenance
- **Deprecated**: Marked for removal, dependency migration
- **Archived**: Historical reference, no execution

### Review Schedule

- **Monthly**: Workflow effectiveness review
- **Quarterly**: Dependency optimization and reorganization
- **Annually**: Complete workflow strategy assessment

---

**Authority**: This document establishes the definitive debugging workflow
structure. All debugging activities should follow these established patterns and
hierarchies.
